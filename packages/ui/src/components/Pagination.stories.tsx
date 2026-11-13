import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pagination } from "./Pagination";

/**
 * Previous and next page as secondary buttons (44 px, radius 8, 1 px border.strong, body medium,
 * a 20 px chevron) with the status between them in text.muted, 16 px apart, centred. With nowhere
 * to go, a link is drawn off (the disabled button look, aria-disabled, no href). The API has no
 * total, so the status is "Page N" without "of M".
 */
const meta = {
  title: "Navigation/Pagination",
  component: Pagination,
  args: { previousHref: "#page-1", nextHref: "#page-3", status: "Page 2" },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Middle: Story = {};

export const FirstPage: Story = {
  name: "First page",
  args: { previousHref: undefined, nextHref: "#page-2", status: "Page 1" },
};

export const LastPage: Story = {
  name: "Last page",
  args: { previousHref: "#page-1", nextHref: undefined, status: "Page 2" },
};

export const Dark: Story = { parameters: { theme: "dark" } };

export const FirstPageDark: Story = {
  name: "First page, dark",
  parameters: { theme: "dark" },
  args: { previousHref: undefined, nextHref: "#page-2", status: "Page 1" },
};
