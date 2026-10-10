import type { Meta, StoryObj } from "@storybook/react-vite";
import { DemoBanner } from "./DemoBanner";

const meta = {
  title: "Layout/DemoBanner",
  component: DemoBanner,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DemoBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The message wraps on a phone instead of overflowing. */
export const Mobile: Story = {
  // The "mobile" tag makes the visual test render this story at phone width too.
  tags: ["mobile"],
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
