import type { Meta, StoryObj } from "@storybook/react-vite";
import { Notice } from "./Notice";

const meta = {
  title: "Layout/Notice",
  component: Notice,
  args: {
    tone: "info",
    children: "Delivery times may vary during holidays.",
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["info", "warning", "error"] },
  },
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Warning: Story = {
  args: {
    tone: "warning",
    children: "Orders placed after noon ship the next business day.",
  },
};

export const Error: Story = {
  args: {
    tone: "error",
    children: "We could not load delivery options. Please try again.",
  },
};
