import type { Meta, StoryObj } from "@storybook/react-vite";
import { CurrencySwitch } from "./CurrencySwitch";

/**
 * Rupees or dollars for every price on the page. Two buttons in a named group ("Prices in"); the
 * current one is pressed (aria-pressed), filled brand.primary with text.on-brand, and has a tick.
 * The other is surface.page, surface.hover on hover. Pressing it submits the form (a server
 * action in the shop), which keeps the choice in a cookie. Dollars are for display only.
 */
const meta = {
  title: "Forms/CurrencySwitch",
  component: CurrencySwitch,
  args: { current: "INR", action: "#" },
} satisfies Meta<typeof CurrencySwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rupees: Story = {};

export const Dollars: Story = { args: { current: "USD" } };

export const Hindi: Story = {
  args: { label: "कीमतें", names: { INR: "₹ रुपये", USD: "$ डॉलर" } },
};

export const Dark: Story = { parameters: { theme: "dark" } };

export const DollarsDark: Story = {
  name: "Dollars, dark",
  parameters: { theme: "dark" },
  args: { current: "USD" },
};
