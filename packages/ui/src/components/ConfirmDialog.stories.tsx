import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

const meta = {
  title: "Feedback/ConfirmDialog",
  component: ConfirmDialog,
  args: {
    open: true,
    title: "Delete this address?",
    confirmLabel: "Delete",
    cancelLabel: "Keep it",
    onConfirm: () => {},
    onCancel: () => {},
    children: <p>12 Sample Lane, Lakeside will be removed from your addresses.</p>,
  },
  // The dialog sits over the page, so give the story room to show it.
  decorators: [
    (Story) => (
      <div style={{ minHeight: "100vh" }}>
        <p>The page behind the dialog.</p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Dark: Story = { parameters: { theme: "dark" } };

export const Busy: Story = { args: { busy: true } };

export const QuestionOnly: Story = { name: "Question only", args: { children: undefined } };

/** On a phone the buttons stack, the safe one at the bottom within reach. */
export const Mobile: Story = { tags: ["mobile"] };

function Opener() {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("Nothing yet");
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <output style={{ marginLeft: 16 }}>{said}</output>
      <ConfirmDialog
        open={open}
        title="Delete this address?"
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={() => {
          setOpen(false);
          setSaid("Deleted");
        }}
        onCancel={() => {
          setOpen(false);
          setSaid("Kept");
        }}
      />
    </>
  );
}

/** Closed until the button opens it; used by the keyboard test. */
export const FromAButton: Story = { name: "From a button", render: () => <Opener /> };
