import { getMessages } from "next-intl/server";
import type en from "../../messages/en.json";

type Messages = typeof en;

// A namespace's words as written, for a client form: a placeholder such as {minutes} stays in, for
// the browser to fill. Typed from en.json, so a page passing them to a form that needs a word the
// namespace lacks fails to build (messages.test.ts keeps hi.json to the same keys).
export async function wordsFor<N extends keyof Messages>(
  locale: string,
  namespace: N,
): Promise<Messages[N]> {
  const messages = (await getMessages({ locale })) as unknown as Messages;
  return messages[namespace];
}
