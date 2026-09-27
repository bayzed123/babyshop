import { chromium } from "@playwright/test";
const S = "/tmp/claude-0/-home-user/6bbd2193-51f3-5af6-8f71-52ec8e9a4438/scratchpad";
const [,, vw, w, h, full, ...urls] = process.argv;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: +w, height: +h } });
const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
for (const url of urls) {
  await p.goto("http://127.0.0.1:8787" + url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const name = url.replace(/[^a-z0-9]+/gi, "_") || "home";
  await p.screenshot({ path: S + "/" + vw + name + ".png", fullPage: full === "1" });
}
console.log("errors:", JSON.stringify(errs.filter(e=>!/fonts.g|net::/.test(e))));
await b.close();
