import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";
// Geist, the typeface the tokens name, so stories measure like the Figma file. Storybook only:
// the package ships no font files, and the apps load Geist themselves (next/font).
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
// The design tokens as CSS variables, as every app that uses the components loads them.
import "../src/theme.css";

// Every story renders on its theme's page colour, whatever the viewer's system setting: light by
// default, dark with `parameters: { theme: "dark" }`, so the light and dark mockups can be
// compared side by side. A sheet wider than the canvas widens its page with it.
const preview: Preview = {
  // Every component gets a generated docs page from its stories and prop types.
  tags: ["autodocs"],
  decorators: [
    (Story, { parameters }) => {
      const theme = parameters.theme === "dark" ? "dark" : "light";
      return createElement(
        "div",
        {
          "data-theme": theme,
          style: {
            background: "var(--mb-color-surface-page)",
            color: "var(--mb-color-text-default)",
            minWidth: "fit-content",
            padding: theme === "dark" ? "24px" : undefined,
          },
        },
        createElement(Story),
      );
    },
  ],
};

export default preview;
