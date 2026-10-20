import unittest
import xml.etree.ElementTree as ET
from unittest.mock import patch

from update_news import collect_feeds, merge_articles, parse_feed


class ParseFeedTests(unittest.TestCase):
    def test_parses_rss_and_removes_markup_from_summary(self):
        payload = b"""<?xml version="1.0"?>
        <rss version="2.0"><channel><item>
          <title>AI research update</title>
          <link>https://example.com/story</link>
          <pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate>
          <description><![CDATA[<p>Research <strong>summary</strong>.</p>]]></description>
        </item></channel></rss>"""
        source = {"name": "Example", "url": "https://example.com/feed.xml", "language": "en"}

        articles, skipped = parse_feed(payload, source)

        self.assertEqual(skipped, 0)
        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0]["title"], "AI research update")
        self.assertEqual(articles[0]["sourceSummary"], "Research summary.")
        self.assertEqual(articles[0]["publishedAt"], "2026-10-19T10:00:00Z")

    def test_parses_atom_links_and_updated_dates(self):
        payload = b"""<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom"><entry>
          <title>New model</title>
          <link rel="alternate" href="https://example.com/model"/>
          <updated>2026-10-19T12:30:00Z</updated>
          <summary>Model release notes</summary>
        </entry></feed>"""
        source = {"name": "Example", "url": "https://example.com/feed.xml", "language": "en"}

        articles, skipped = parse_feed(payload, source)

        self.assertEqual(skipped, 0)
        self.assertEqual(articles[0]["url"], "https://example.com/model")
        self.assertEqual(articles[0]["publishedAt"], "2026-10-19T12:30:00Z")

    def test_merge_preserves_editorial_fields_and_previous_items(self):
        current = [
            {
                "id": "existing",
                "title": "Updated title",
                "url": "https://example.com/current",
                "source": "Example",
                "publishedAt": "2026-10-19T12:00:00Z",
                "language": "en",
                "sourceSummary": "New publisher snippet",
            }
        ]
        existing = [
            {
                "id": "existing",
                "title": "Old title",
                "url": "https://example.com/current",
                "summary": "Reviewed editorial summary",
            },
            {
                "id": "older",
                "title": "Older item",
                "url": "https://example.com/older",
                "publishedAt": "2026-10-18T12:00:00Z",
            },
        ]

        merged = merge_articles(current, existing)

        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]["title"], "Updated title")
        self.assertEqual(merged[0]["sourceSummary"], "New publisher snippet")
        self.assertEqual(merged[0]["summary"], "Reviewed editorial summary")
        self.assertEqual(merged[1]["id"], "older")

    def test_skips_insecure_article_links(self):
        payload = b"""<rss><channel><item>
          <title>Unsafe item</title><link>http://example.com/story</link>
        </item></channel></rss>"""
        source = {"name": "Example", "url": "https://example.com/feed.xml", "language": "en"}

        articles, skipped = parse_feed(payload, source)

        self.assertEqual(articles, [])
        self.assertEqual(skipped, 1)

    def test_upgrades_arxiv_http_links_to_https(self):
        payload = b"""<rss><channel><item>
          <title>AI paper</title><link>http://arxiv.org/abs/1234.5678</link>
        </item></channel></rss>"""
        source = {
            "name": "arXiv",
            "url": "https://rss.arxiv.org/rss/cs.AI",
            "language": "en",
            "upgrade_http_hosts": ["arxiv.org"],
        }

        articles, skipped = parse_feed(payload, source)

        self.assertEqual(skipped, 0)
        self.assertEqual(articles[0]["url"], "https://arxiv.org/abs/1234.5678")

    def test_partial_feed_failures_keep_healthy_sources(self):
        sources = [
            {"name": "Working", "url": "https://working.example/feed"},
            {"name": "Unavailable", "url": "https://unavailable.example/feed"},
        ]
        article = {"id": "one", "publishedAt": "2026-10-19T10:00:00Z"}
        with patch("update_news.fetch_feed", side_effect=[([article], 0), ET.ParseError("invalid XML")]):
            incoming, statuses = collect_feeds(sources)

        self.assertEqual(incoming, [article])
        self.assertIsNone(statuses[0]["error"])
        self.assertEqual(statuses[1]["error"], "invalid XML")

    def test_all_feed_failures_prevent_an_empty_update(self):
        sources = [{"name": "Unavailable", "url": "https://unavailable.example/feed"}]
        with patch("update_news.fetch_feed", side_effect=ET.ParseError("invalid XML")):
            with self.assertRaisesRegex(RuntimeError, "All news feeds failed"):
                collect_feeds(sources)


if __name__ == "__main__":
    unittest.main()
