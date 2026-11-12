import { PlusIcon } from "@manasbal/icons";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";

const meta = {
  title: "Forms/Button",
  component: Button,
  args: { children: "Add to cart" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost"] },
    size: { control: "inline-radio", options: ["md", "sm"] },
    icon: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: "secondary" } };

export const Ghost: Story = { args: { variant: "ghost" } };

export const Small: Story = { args: { size: "sm" } };

export const WithIcon: Story = { args: { icon: <PlusIcon /> } };

export const Disabled: Story = { args: { disabled: true } };

const variants: ButtonVariant[] = ["primary", "secondary", "ghost"];
const sizes: ButtonSize[] = ["md", "sm"];
const states = ["default", "hover", "focus", "disabled"] as const;

/** Every variant, size and state, laid out like the Figma sheet: one state per column. */
function Sheet() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, max-content)",
        gap: "24px 64px",
        alignItems: "center",
        // Room for the focus ring, which the screenshot would otherwise cut off.
        padding: "8px",
      }}
    >
      {variants.flatMap((variant) =>
        sizes.flatMap((size) =>
          [false, true].flatMap((withIcon) =>
            states.map((state) => (
              <div key={`${variant}-${size}-${withIcon}-${state}`}>
                <Button
                  variant={variant}
                  size={size}
                  icon={withIcon ? <PlusIcon /> : undefined}
                  disabled={state === "disabled"}
                  data-preview={state === "hover" || state === "focus" ? state : undefined}
                >
                  Add to cart
                </Button>
              </div>
            )),
          ),
        ),
      )}
    </div>
  );
}

/** Columns: default, hover, focus, disabled. Rows: md, md with icon, sm, sm with icon, per variant. */
export const AllStatesLight: Story = { name: "All states, light", render: () => <Sheet /> };

export const AllStatesDark: Story = {
  name: "All states, dark",
  parameters: { theme: "dark" },
  render: () => <Sheet />,
};
