const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const requestTimeoutMs = 2 * 60 * 1000;
const publicFiles = new Set(["index.html", "legal.html", "styles.css", "info.css", "script.js", "news.js", "articles.json", "cookie-settings.js", "favicon.svg", "robots.txt", "sitemap.xml"]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!publicFiles.has(name)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  fs.readFile(path.join(root, name), (error, data) => {
    if (error) {
      res.writeHead(500).end("Server error");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(name)], "Cache-Control": "no-cache" });
    res.end(data);
  });
});

server.headersTimeout = requestTimeoutMs;
server.requestTimeout = requestTimeoutMs;
server.listen(port, "127.0.0.1", () => console.log(`WRLDSI running at http://localhost:${port}`));
