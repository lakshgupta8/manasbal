export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "no-tool-credit": ({ raw }) => [
          !/^(co-authored-by:.*\bclaude\b|generated with\b)/im.test(raw),
          "remove the tool-credit line: no Co-Authored-By: Claude or 'Generated with' lines",
        ],
      },
    },
  ],
  rules: {
    "signed-off-by": [2, "always", "Signed-off-by:"],
    "no-tool-credit": [2, "always"],
  },
};
