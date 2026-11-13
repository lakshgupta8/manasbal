import type { Meta, StoryObj } from "@storybook/react-vite";
import { Breadcrumbs } from "./Breadcrumbs";

/**
 * Where a page sits, from Home down to it (W3C APG Breadcrumb pattern): a navigation named
 * "Breadcrumbs" (pages pass their own words), an ordered list, the current page marked
 * aria-current="page" and not a link. Small type (14/20); links in text.action, underlined; the
 * current page in text.default, medium; 8 px gaps around a 6 px CSS chevron in text.muted, which
 * screen readers don't read. Wraps onto more lines when narrow.
 */
const meta = {
  title: "Navigation/Breadcrumbs",
  component: Breadcrumbs,
  args: {
    trail: [
      { href: "#home", label: "Home" },
      { href: "#clothing", label: "Clothing" },
      { href: "#clothing-men", label: "Men" },
    ],
    current: "Shirts",
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneLevel: Story = {
  name: "One level",
  args: { trail: [{ href: "#home", label: "Home" }], current: "Clothing" },
};

export const Phone: Story = {
  tags: ["mobile"],
  args: {
    trail: [
      { href: "#home", label: "Home" },
      { href: "#electronics", label: "Electronics accessories" },
      { href: "#mobile", label: "Mobile accessories" },
    ],
    current: "Phone cases",
  },
};

export const Dark: Story = { parameters: { theme: "dark" } };
