import type { Meta, StoryObj } from "@storybook/react-vite";
import { Price } from "./Price";

/**
 * A price from whole paise, in rupees with Indian grouping: 12999900 paise shows ₹1,29,999.00.
 * Anything that is not a safe, non-negative whole number of paise (a fraction, NaN, Infinity, a
 * negative, a string) throws a TypeError. It always formats with en-IN, so a Hindi page shows the
 * same digits; screen readers hear "1,29,999 rupees", with the word from `unit`.
 */
const meta = {
  title: "Product/Price",
  component: Price,
  args: { paise: 12999900 },
} satisfies Meta<typeof Price>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {};

export const Large: Story = { args: { size: "large" } };

export const Hindi: Story = { args: { size: "large", unit: "रुपये" } };

const amounts = [0, 100, 4950, 129900, 12999900, 1234567800] as const;

/** Small and large, from nothing to a crore. */
function Sheet() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, max-content)",
        alignItems: "baseline",
        gap: "12px 48px",
        padding: 8,
      }}
    >
      {amounts.flatMap((paise) => [
        <Price key={`${paise}-large`} paise={paise} size="large" />,
        <Price key={`${paise}-small`} paise={paise} />,
      ])}
    </div>
  );
}

export const AllLight: Story = { name: "All sizes, light", render: () => <Sheet /> };

export const AllDark: Story = {
  name: "All sizes, dark",
  parameters: { theme: "dark" },
  render: () => <Sheet />,
};

/** The same price shown approximately in dollars at DEMO_USD_RATE, for display only. */
export const Dollars: Story = { args: { size: "large", currency: "USD" } };

export const DollarsSmall: Story = { name: "Dollars, small", args: { currency: "USD" } };

/** Dollars on a Hindi page: Latin digits, Hindi words for screen readers. */
export const DollarsHindi: Story = {
  name: "Dollars, Hindi",
  args: {
    size: "large",
    currency: "USD",
    dollarWords: { about: "लगभग", dollars: "डॉलर", cents: "सेंट" },
  },
};

export const DollarsDark: Story = {
  name: "Dollars, dark",
  parameters: { theme: "dark" },
  args: { size: "large", currency: "USD" },
};
