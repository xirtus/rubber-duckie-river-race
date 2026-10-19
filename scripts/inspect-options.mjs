import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5180/?test=1");
await page.locator("#mode").waitFor();
console.log(await page.locator("#mode").evaluate((e) => e.outerHTML));
console.log(await page.locator("body").innerText());
await browser.close();
