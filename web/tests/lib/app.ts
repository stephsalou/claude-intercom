import type { Page } from "@playwright/test";

export const APP_URL = "http://localhost:4174";

export async function gotoAppLogin(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/login`);
  await page.getByPlaceholder("ex : sofia.k").waitFor();
}

export async function setAppTab(page: Page, tab: "Agents & flux" | "Utilisateurs" | "Webhooks"): Promise<void> {
  await page.locator(".seg-opt", { hasText: tab }).click();
}
