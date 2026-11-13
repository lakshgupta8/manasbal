import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { PageState, type PageStateKind } from "./PageState";

/**
 * A page, or part of one, with nothing to show yet or at all. Each kind says in words what is
 * happening, with an icon from @manasbal/icons (never colour alone): loading (clock, a polite
 * live region), error (alert, in feedback.error), empty (package) and not-found (info).
 *
 * Centred, at most 480 px wide, 48 px padding top and bottom: a 48 px circle (1 px border.default)
 * holding the 24 px icon, 16 px to the title (heading-3, 24/32 semibold), 8 px to the body (body,
 * text.muted), 24 px to the action.
 */
const meta = {
  title: "Feedback/PageState",
  component: PageState,
  args: { kind: "loading", title: "Loading products" },
} satisfies Meta<typeof PageState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const ErrorState: Story = {
  name: "Error",
  args: {
    kind: "error",
    title: "This page couldn't load",
    children: <p>The shop lost touch with its data for a moment. Try again in a little while.</p>,
    action: (
      <>
        <Button>Try again</Button>
        <a href="#home">Go to the home page</a>
      </>
    ),
  },
};

export const Empty: Story = {
  args: {
    kind: "empty",
    title: "No products here yet",
    headingLevel: 2,
    action: <a href="#home">Go to the home page</a>,
  },
};

export const NotFound: Story = {
  name: "Not found",
  args: {
    kind: "not-found",
    title: "Category not found",
    children: <p>There is no category at this address. The link may be mistyped.</p>,
    action: <a href="#home">Go to the home page</a>,
  },
};

const kinds: readonly PageStateKind[] = ["loading", "error", "empty", "not-found"];

/** All four, side by side, in the dark. */
export const AllDark: Story = {
  name: "All kinds, dark",
  parameters: { theme: "dark" },
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 480px)", gap: 24 }}>
      {kinds.map((kind) => (
        <PageState key={kind} kind={kind} title={`The ${kind} state`} headingLevel={2}>
          <p>Words that say what is happening.</p>
        </PageState>
      ))}
    </div>
  ),
};
