#!/usr/bin/env node
/**
 * Renders the ride-on toy product photos (studio-style 3D renders) into public/img/products/*.webp.
 * The images are committed; this only needs re-running when a model changes.
 *
 *   node scripts/render-toys.mjs                 # all
 *   node scripts/render-toys.mjs motorcycle      # one
 *
 * Needs Playwright's Chromium (PW_CHROMIUM_PATH to use a preinstalled one) and the three.js dev dependency.
 */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { SHOTS } from "./render-toys/shots.mjs";

const ROOT = process.cwd();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = path.startsWith("/node_modules/") ? join(ROOT, path) : join(ROOT, "scripts/render-toys", path === "/" ? "index.html" : path);
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const only = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
for (const shot of SHOTS.filter((s) => !only.length || only.includes(s.file) || only.includes(s.model))) {
  const t = Date.now();
  const url = await page.evaluate(({ model, opts, view }) => window.renderToy(model, opts, view), shot);
  const out = join(ROOT, "public/img/products", `${shot.file}.webp`);
  await writeFile(out, Buffer.from(url.split(",")[1], "base64"));
  console.log(`✔ ${shot.file}.webp (${Math.round((Date.now() - t) / 100) / 10}s)`);
}
await browser.close();
server.close();
