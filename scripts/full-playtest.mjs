import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
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
  if (m.type() === "error") errors.push(m.text().slice(0, 1200));
});
await page.goto("http://127.0.0.1:5180/?test=1");
await page
  .getByRole("button", { name: "Let’s follow the river" })
  .waitFor({ timeout: 60000 });
await page.getByLabel("Race format").selectOption("daily");
await page.getByRole("button", { name: "Let’s follow the river" }).click();
await page.evaluate(() => window.riverTest.advance(60));
const first = await page.evaluate(() => window.riverTest.getSnapshot());
const beforeWalk = await page.evaluate(() => window.riverTest.getPlayer());
await page.keyboard.down("KeyD");
await page.waitForTimeout(700);
await page.keyboard.up("KeyD");
const afterWalk = await page.evaluate(() => window.riverTest.getPlayer());
assert.ok(
  Math.hypot(afterWalk.x - beforeWalk.x, afterWalk.z - beforeWalk.z) > 1,
  "First-person movement responds to input",
);
await page.getByRole("button", { name: "Make a river prediction" }).click();
await page.locator('[data-predict="left"]').click();
await page.keyboard.press("KeyC");
await page.keyboard.press("KeyF");
await page.waitForTimeout(1000);
assert.equal(await page.locator("#photo-count").innerText(), "1 photograph");
const next = await page.evaluate(() => window.riverTest.getSnapshot());
assert.ok(next.tick > first.tick, "Photography did not pause simulation");
await page.getByRole("button", { name: "Album", exact: true }).click();
await page.locator(".print").first().waitFor();
await page.locator("[data-favorite]").first().click();
await expect(page.locator("[data-favorite]").first()).toContainText(
  "Saved favorite",
);
await page.getByRole("button", { name: "Close", exact: true }).click();
await page.keyboard.press("KeyC");
for (const [name, z, tick] of [
  ["cathedral", 105, 3000],
  ["gold", 182, 5200],
  ["falls", 248, 7000],
  ["fork", 323, 10000],
  ["cascade", 524, 15000],
]) {
  await page.evaluate(
    ({ z, tick }) => {
      window.riverTest.advance(
        Math.max(0, tick - window.riverTest.getSnapshot().tick),
      );
      window.riverTest.stand(z, 0.8, -0.22, 8);
    },
    { z, tick },
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: `/tmp/duck-${name}.png` });
}
console.log(
  "Render metrics",
  await page.evaluate(() => window.riverTest.metrics()),
);
await page.evaluate(() => window.riverTest.advance(42000));
await page.getByRole("dialog", { name: "Every duck has a story." }).waitFor();
assert.equal(await page.locator(".print").count(), 1);
console.log("Finish summary", await page.locator(".stats").innerText());
await page.screenshot({ path: "/tmp/duck-finish.png" });
await page.reload();
await page.getByRole("button", { name: "River Album", exact: true }).click();
await page.locator(".print").first().waitFor();
assert.match(
  await page.locator("[data-favorite]").first().innerText(),
  /Saved favorite/,
);
console.log("Photo and favorite persisted across reload");
await page.getByRole("button", { name: "Close", exact: true }).click();
await page.getByRole("button", { name: "Duck Book", exact: true }).click();
console.log(
  "Duck Book discoveries",
  await page.locator(".collection:not(.locked)").count(),
);
await page.getByRole("button", { name: "Close", exact: true }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "/tmp/duck-mobile.png" });
assert.ok(
  await page
    .getByRole("button", { name: "Let’s follow the river" })
    .isVisible(),
);
console.log("Browser errors", errors);
await browser.close();
assert.deepEqual(errors, []);
