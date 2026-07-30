import type { Page } from "@playwright/test";

export const REFERENCE_URL = "http://localhost:4173/Intercom%20Dashboard.dc.html";

export async function gotoReference(page: Page): Promise<void> {
  await page.goto(REFERENCE_URL);
  await page.getByPlaceholder("ex : sofia.k").waitFor();
}

export async function loginReference(page: Page): Promise<void> {
  await page.getByPlaceholder("ex : sofia.k").fill("sofia.k");
  await page.getByPlaceholder("••••••••").fill("demo-password");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.locator(".seg-opt", { hasText: "Agents & flux" }).waitFor();
}

export async function setReferenceTab(
  page: Page,
  tab: "Agents & flux" | "Utilisateurs" | "Webhooks",
): Promise<void> {
  await page.locator(".seg-opt", { hasText: tab }).click();
}

export async function setReferenceScenario(
  page: Page,
  scenario: "Peuplé" | "0 agent" | "0 workspace",
): Promise<void> {
  await page.locator(".seg-opt", { hasText: scenario }).click();
}
