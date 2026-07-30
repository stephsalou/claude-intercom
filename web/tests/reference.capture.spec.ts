import { test, expect } from "@playwright/test";
import { gotoReference, loginReference, setReferenceTab, setReferenceScenario } from "./lib/reference";

// One-time (re-run only when the design mock itself changes) capture of the
// reference mock (front-end/Intercom Dashboard.dc.html) as the golden
// screenshots visual.spec.ts compares the Next.js app against. Run with:
//   npx playwright test reference.capture.spec.ts --update-snapshots

test("login screen", async ({ page }) => {
  await gotoReference(page);
  await expect(page).toHaveScreenshot("login.png");
});

test("agents & flux — populated", async ({ page }) => {
  await gotoReference(page);
  await loginReference(page);
  // Screenshot promptly, before the demo's own ticking timers (6-9s) mutate content.
  await expect(page).toHaveScreenshot("agents-populated.png", {
    mask: [page.locator("div").filter({ hasText: /Flux en direct/ }).locator("..")],
  });
});

test("agents & flux — no agents", async ({ page }) => {
  await gotoReference(page);
  await loginReference(page);
  await setReferenceScenario(page, "0 agent");
  await expect(page).toHaveScreenshot("agents-empty.png");
});

test("no workspace", async ({ page }) => {
  await gotoReference(page);
  await loginReference(page);
  await setReferenceScenario(page, "0 workspace");
  await expect(page).toHaveScreenshot("no-workspace.png");
});

test("users & rôles tab", async ({ page }) => {
  await gotoReference(page);
  await loginReference(page);
  await setReferenceTab(page, "Utilisateurs");
  await expect(page).toHaveScreenshot("users-tab.png");
});

test("webhooks tab", async ({ page }) => {
  await gotoReference(page);
  await loginReference(page);
  await setReferenceTab(page, "Webhooks");
  await expect(page).toHaveScreenshot("webhooks-tab.png");
});
