import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 1600));
});
await page.goto(process.env.RIVER_URL || "http://127.0.0.1:5180");
await page
  .getByRole("button", { name: "Let’s follow the river" })
  .waitFor({ timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/duck-menu.png" });
console.log("Menu", await page.locator("h1").innerText());
await page.getByRole("button", { name: "Let’s follow the river" }).click();
await page.waitForTimeout(5000);
await page.screenshot({ path: "/tmp/duck-race.png" });
console.log("Race", await page.locator("#race-clock").innerText());
await page.keyboard.press("KeyF");
await page.waitForTimeout(800);
console.log("Photo", await page.locator("#photo-count").innerText());
await page.getByRole("button", { name: "Album", exact: true }).click();
await page.getByRole("dialog").waitFor();
await page.waitForTimeout(500);
console.log("Album photos", await page.locator(".print").count());
await page.screenshot({ path: "/tmp/duck-album.png" });
console.log("Errors", errors);
await browser.close();
if (errors.length) process.exitCode = 1;
