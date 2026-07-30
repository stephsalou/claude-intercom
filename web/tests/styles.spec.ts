import { test, expect } from "@playwright/test";
import { gotoReference } from "./lib/reference";
import { gotoAppLogin } from "./lib/app";

const SELECTORS: Record<string, string[]> = {
  body: ["background-color", "font-family", "font-size", "line-height"],
  h1: ["font-family", "font-size", "font-weight", "letter-spacing"],
  ".btn-primary": ["background-color", "color", "border-radius", "padding", "font-family"],
  ".input": ["border-radius", "background-color", "border-color", "padding-left"],
  ".card": ["border-radius", "background-color", "gap"],
};

// Two equivalent CSS color serializations for the same value can differ between
// pages/contexts (`rgba(32, 30, 29, 0.16)` vs `color(srgb 0.125 0.118 0.114 / 0.16)`)
// — normalize both into a comparable [r,g,b,a] tuple (0-255, 0-1) before comparing.
function normalizeColor(value: string): string {
  const rgbMatch = value.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  if (rgbMatch) {
    const [, r, g, b, a] = rgbMatch;
    return `${Math.round(+r)},${Math.round(+g)},${Math.round(+b)},${(+(a ?? 1)).toFixed(2)}`;
  }
  const colorMatch = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (colorMatch) {
    const [, r, g, b, a] = colorMatch;
    return `${Math.round(+r * 255)},${Math.round(+g * 255)},${Math.round(+b * 255)},${(+(a ?? 1)).toFixed(2)}`;
  }
  return value;
}

async function computedStyles(page: import("@playwright/test").Page, selector: string, props: string[]) {
  const raw = await page.locator(selector).first().evaluate((el, props) => {
    const style = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)]));
  }, props);
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, k.includes("color") ? normalizeColor(v) : v]),
  );
}

test("login screen: computed styles match the design mock 1:1", async ({ page, browser }) => {
  await gotoReference(page);
  const refPage = page;

  const appPage = await browser.newPage();
  await gotoAppLogin(appPage);

  for (const [selector, props] of Object.entries(SELECTORS)) {
    const refStyles = await computedStyles(refPage, selector, props);
    const appStyles = await computedStyles(appPage, selector, props);
    expect(appStyles, `styles for "${selector}"`).toEqual(refStyles);
  }

  await appPage.close();
});
