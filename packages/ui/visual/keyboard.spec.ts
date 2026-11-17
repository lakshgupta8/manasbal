import { expect, test } from "@playwright/test";

// What jsdom can't show: how a real browser moves through a radio group by keyboard. Runs in the
// same Docker browser as the screenshots (see stories.spec.ts).
test.skip(
  !process.env.PW_WS_ENDPOINT,
  "Run with `pnpm test:visual`, which provides the Docker browser",
);

test("VariantPicker: the arrows move and choose, skip what can't be chosen, and Tab leaves", async ({
  page,
}) => {
  // Sizes S, M (chosen), L (not available), XL.
  await page.goto("/iframe.html?id=forms-variantpicker--default&viewMode=story");
  const root = page.locator("#storybook-root");
  const size = (name: string) => root.getByRole("radio", { name, exact: true });
  await expect(size("M")).toBeChecked();

  // Tab goes to the chosen option only, not to each one.
  await page.keyboard.press("Tab");
  await expect(size("M")).toBeFocused();

  // Right moves past L, which can't be chosen, to XL, and chooses it.
  await page.keyboard.press("ArrowRight");
  await expect(size("XL")).toBeFocused();
  await expect(size("XL")).toBeChecked();
  await expect(size("L (not available)")).toBeDisabled();

  // Right from the last wraps round to the first; Left comes back.
  await page.keyboard.press("ArrowRight");
  await expect(size("S")).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(size("XL")).toBeChecked();

  // Down and Up do the same as Right and Left.
  await page.keyboard.press("ArrowUp");
  await expect(size("M")).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(size("XL")).toBeChecked();

  // Tab leaves the group: nothing in it has focus any more.
  await page.keyboard.press("Tab");
  await expect(root.locator("input:focus")).toHaveCount(0);
  // Shift+Tab comes back to the chosen option.
  await page.keyboard.press("Shift+Tab");
  await expect(size("XL")).toBeFocused();
});

test("ConfirmDialog: focus starts on the safe choice, stays inside, and Esc cancels", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=feedback-confirmdialog--from-a-button&viewMode=story");
  const root = page.locator("#storybook-root");
  // The page's own Delete button; the dialog (also inside the root) has one too.
  const opener = root.getByRole("button", { name: "Delete" }).first();
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "Delete this address?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep it" })).toBeFocused();

  // Tab moves between the two buttons and never reaches the page behind.
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Tab");
    await expect(opener).not.toBeFocused();
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(root.getByText("Kept")).toBeVisible();
  await expect(opener).toBeFocused();

  // Enter on the focused cancel button cancels too.
  await opener.press("Enter");
  await expect(dialog.getByRole("button", { name: "Keep it" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
});
