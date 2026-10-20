import argparse
import hashlib
import json
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCES_FILE = ROOT / "content" / "news-sources.json"
DEFAULT_OUTPUT = ROOT / "articles.json"
MAX_BYTES = 4 * 1024 * 1024
ITEMS_PER_SOURCE = 8
MAX_STORED_ARTICLES = 100
SUMMARY_LENGTH = 280


class FeedTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"script", "style"}:
            self.skip_depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in {"script", "style"} and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data):
        if not self.skip_depth:
            self.parts.append(data)


def local_name(tag):
    return tag.rsplit("}", 1)[-1].split(":")[-1].lower()


def child_text(element, names):
    names = {name.lower() for name in names}
    for child in list(element):
        if local_name(child.tag) in names:
            return "".join(child.itertext()).strip()
    return ""


def clean_summary(value):
    parser = FeedTextParser()
    parser.feed(value)
    text = re.sub(r"\s+", " ", "".join(parser.parts)).strip()
    if len(text) <= SUMMARY_LENGTH:
        return text
    shortened = text[: SUMMARY_LENGTH - 1].rsplit(" ", 1)[0].rstrip()
    return (shortened or text[: SUMMARY_LENGTH - 1]) + "…"


def parse_date(value):
    if not value:
        return None
    try:
        try:
            result = parsedate_to_datetime(value)
        except (TypeError, ValueError, OverflowError):
            result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError, OverflowError):
        return None
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def entry_link(entry, source):
    links = [element for element in list(entry) if local_name(element.tag) == "link"]
    raw_link = ""
    if local_name(entry.tag) == "entry":
        chosen = next(
            (element for element in links if element.attrib.get("rel", "alternate") == "alternate"),
            links[0] if links else None,
        )
        if chosen is not None:
            raw_link = chosen.attrib.get("href") or "".join(chosen.itertext()).strip()
    else:
        raw_link = child_text(entry, {"link"})
    absolute = urllib.parse.urljoin(source["url"], raw_link)
    parsed = urllib.parse.urlparse(absolute)
    if parsed.scheme == "http" and parsed.hostname in source.get("upgrade_http_hosts", []):
        absolute = parsed._replace(scheme="https").geturl()
        parsed = urllib.parse.urlparse(absolute)
    if parsed.scheme != "https" or not parsed.netloc:
        return ""
    return absolute


def parse_feed(payload, source):
    root = ET.fromstring(payload)
    records = []
    skipped = 0

    for entry in root.iter():
        if local_name(entry.tag) not in {"item", "entry"}:
            continue

        title = child_text(entry, {"title"})
        url = entry_link(entry, source)
        if not title or not url:
            skipped += 1
            continue

        summary = child_text(entry, {"description", "summary", "content", "encoded"})
        date = child_text(entry, {"pubdate", "published", "updated", "date"})
        records.append(
            {
                "id": hashlib.sha256(url.encode("utf-8")).hexdigest()[:16],
                "title": re.sub(r"\s+", " ", title).strip(),
                "url": url,
                "source": source["name"],
                "publishedAt": parse_date(date),
                "language": source["language"],
                "sourceSummary": clean_summary(summary),
            }
        )

    return records, skipped


def fetch_feed(source):
    request = urllib.request.Request(
        source["url"],
        headers={"User-Agent": "WRLDSI-NewsBot/1.0 (+https://wrldsi.com)"},
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        payload = response.read(MAX_BYTES + 1)
    if len(payload) > MAX_BYTES:
        raise ValueError(f"Feed is larger than {MAX_BYTES} bytes")
    return parse_feed(payload, source)


def article_sort_key(article):
    value = article.get("publishedAt")
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return result if result.tzinfo else result.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return datetime.min.replace(tzinfo=timezone.utc)


def merge_articles(incoming, existing):
    existing_by_id = {
        article["id"]: article
        for article in existing
        if isinstance(article, dict) and isinstance(article.get("id"), str)
    }
    generated_fields = {
        "id",
        "title",
        "url",
        "source",
        "publishedAt",
        "language",
        "sourceSummary",
    }
    merged_by_id = {}

    for article in incoming:
        previous = existing_by_id.get(article["id"], {})
        merged_by_id[article["id"]] = {
            **previous,
            **article,
            **{key: value for key, value in previous.items() if key not in generated_fields},
        }

    for article in existing:
        if isinstance(article, dict) and isinstance(article.get("id"), str):
            merged_by_id.setdefault(article["id"], article)

    merged = sorted(merged_by_id.values(), key=article_sort_key, reverse=True)
    return merged[:MAX_STORED_ARTICLES]


def read_existing_articles(output_path):
    if not output_path.exists():
        return []
    try:
        data = json.loads(output_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read existing articles from {output_path}: {error}") from error
    if not isinstance(data, dict) or not isinstance(data.get("articles"), list):
        raise ValueError(f"Existing article file has an invalid format: {output_path}")
    return data["articles"]


def write_document(output_path, articles):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps({"articles": articles}, ensure_ascii=False, indent=2) + "\n"
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            dir=output_path.parent,
            delete=False,
        ) as temporary_file:
            temporary_file.write(content)
            temporary_path = Path(temporary_file.name)
        temporary_path.replace(output_path)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


def update(output_path):
    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    if not isinstance(sources, list) or not sources:
        raise ValueError(f"No news feeds are configured in {SOURCES_FILE}")

    incoming = []
    failures = []
    for source in sources:
        try:
            records, skipped = fetch_feed(source)
            records.sort(key=article_sort_key, reverse=True)
            incoming.extend(records[:ITEMS_PER_SOURCE])
            print(f"{source['name']}: fetched {len(records)} articles; skipped {skipped} invalid entries")
        except (OSError, ValueError, ET.ParseError, urllib.error.URLError) as error:
            failures.append(f"{source.get('name', source.get('url', 'unknown source'))}: {error}")

    if failures:
        raise RuntimeError("News update failed; no output was written:\n" + "\n".join(failures))

    unique_incoming = {}
    for article in incoming:
        unique_incoming.setdefault(article["id"], article)
    articles = merge_articles(list(unique_incoming.values()), read_existing_articles(output_path))
    write_document(output_path, articles)
    print(f"Wrote {len(articles)} articles to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Collect RSS updates for editorial review.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    arguments = parser.parse_args()
    try:
        update(arguments.output.resolve())
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"News update failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
