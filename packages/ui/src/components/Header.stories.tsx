import { CartIcon, UserIcon } from "@manasbal/icons";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CurrencySwitch } from "./CurrencySwitch";
import { Header } from "./Header";

const meta = {
  title: "Layout/Header",
  component: Header,
  parameters: { layout: "fullscreen" },
  args: {
    links: [
      { href: "/", label: "Home" },
      { href: "/categories", label: "Categories" },
      { href: "/stores", label: "Stores" },
    ],
    languageSwitch: (
      <select aria-label="Language" defaultValue="en">
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
      </select>
    ),
    account: (
      <a href="/account">
        <UserIcon size={20} />
        Account
      </a>
    ),
    cart: (
      <a href="/cart">
        <CartIcon size={20} />
        Cart
      </a>
    ),
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Logo, links and all three slots filled. */
export const Default: Story = {};

/** Only the logo: no links and empty slots draw nothing. */
export const LogoOnly: Story = {
  args: { links: [], languageSwitch: undefined, account: undefined, cart: undefined },
};

/** The links and slots wrap under the logo on a phone. */
export const Mobile: Story = {
  // The "mobile" tag makes the visual test render this story at phone width too.
  tags: ["mobile"],
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

/** With the currency switch in its slot, before the language switch. */
export const WithCurrencySwitch: Story = {
  name: "With currency switch",
  args: { currency: <CurrencySwitch current="INR" action="#" /> },
};
