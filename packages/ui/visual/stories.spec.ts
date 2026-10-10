import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

interface IndexEntry {
  id: string;
  title: string;
  name: string;
  type: "story" | "docs";
  tags?: string[];
}

// Every story in the built Storybook, so a new story is covered without touching this file.
const index = JSON.parse(
  readFileSync(join(import.meta.dirname, "../storybook-static/index.json"), "utf8"),
) as { entries: Record<string, IndexEntry> };
const stories = Object.values(index.entries).filter((entry) => entry.type === "story");

test.skip(
  !process.env.PW_WS_ENDPOINT,
  "Run with `pnpm test:visual`, which provides the Docker browser that baselines are taken in",
);

test("the Storybook build has stories", () => {
  expect(stories.length).toBeGreaterThan(0);
});

for (const story of stories) {
  test(`${story.title} › ${story.name}`, async ({ page }) => {
    if (story.tags?.includes("mobile")) await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    const root = page.locator("#storybook-root");
    await expect(root.locator(":scope > *").first()).toBeAttached();
    await page.evaluate(() => document.fonts.ready);

    await expect(root).toHaveScreenshot(`${story.id}.png`);

    const { violations } = await new AxeBuilder({ page })
      .include("#storybook-root")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
