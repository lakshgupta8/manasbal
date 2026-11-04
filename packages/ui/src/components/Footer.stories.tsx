import type { Meta, StoryObj } from "@storybook/react-vite";
import { Footer } from "./Footer";

const meta = {
  title: "Layout/Footer",
  component: Footer,
  parameters: { layout: "fullscreen" },
  args: {
    links: [
      { href: "/about", label: "About this demo" },
      { href: "/privacy", label: "Privacy" },
      { href: "/source", label: "Source code" },
    ],
    smallPrint: "A portfolio demo. Nothing here is for sale.",
  },
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Links and the line of small print. */
export const Default: Story = {};

/** Only the small print: with no links, no navigation is drawn. */
export const SmallPrintOnly: Story = { args: { links: [] } };

/** The links wrap on a phone. */
export const Mobile: Story = {
  // The "mobile" tag makes the visual test render this story at phone width too.
  tags: ["mobile"],
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
