import { test, expect } from "@playwright/test";
import { gotoAppLogin } from "./lib/app";

// Compares against the golden screenshots captured from the design mock in
// reference.capture.spec.ts (tests/golden/*.png). Only the login screen is
// checked pixel-for-pixel here since it's the one screen reachable without
// seeding a real account + workspace fixture; styles.spec.ts covers computed
// CSS parity for the components shared across every authenticated screen.

test("login screen matches the design mock pixel-for-pixel", async ({ page }) => {
  await gotoAppLogin(page);
  await expect(page).toHaveScreenshot("login.png");
});
