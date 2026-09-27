import { chromium } from "@playwright/test";
const S = "/tmp/claude-0/-home-user/6bbd2193-51f3-5af6-8f71-52ec8e9a4438/scratchpad";
const [,, url, ...ys] = process.argv;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
await p.goto("http://127.0.0.1:8787" + url, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500); await p.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
for (const y of ys) { await p.evaluate((y) => window.scrollTo(0, +y), y); await p.waitForTimeout(300); await p.screenshot({ path: S + "/s" + y + ".png" }); }
await b.close();
