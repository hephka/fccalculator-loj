#!/usr/bin/env node
// Static file server for local development. Node core only, no install, no
// dependency tree — same rule as the rest of the project, and Node is already
// a prerequisite here since verify.js needs it.
//
// The README also offers `python3 -m http.server`, which is fine on most
// machines. This exists because it isn't universal: on a Mac where python3 is
// the Xcode stub and the licence hasn't been accepted, it refuses to run at
// all, and the failure message says nothing about serving files.
//
//   node serve.js          → http://localhost:8834
//   node serve.js 3000     → another port
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8834;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

http.createServer((req, res) => {
  // Strip the query string before touching the filesystem: every page requests
  // shared.js?v=28, and that ?v= is a cache-busting marker, not part of the name.
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";

  // Resolve first, then check the result is still inside ROOT — a request for
  // /../../.ssh/id_rsa would otherwise be served happily.
  const file = path.resolve(ROOT, "." + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found: " + rel);
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      // Never cache during development: the whole point is seeing the edit you
      // just made, and the ?v= convention is for visitors, not for you.
      "cache-control": "no-store",
    });
    res.end(body);
  });
}).listen(PORT, () => {
  console.log(`Serving ${ROOT}\n  http://localhost:${PORT}`);
});
