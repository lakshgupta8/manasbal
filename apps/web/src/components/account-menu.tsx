"use client";

import { Button } from "@manasbal/ui";
import { useAuth } from "./auth-provider";

export interface AccountMenuProps {
  readonly signInHref: string;
  // The words, translated on the server. signedInAs holds a {name} placeholder.
  readonly signInLabel: string;
  readonly signOutLabel: string;
  readonly signedInAs: string;
}

// The header's account slot: a link to sign in, or who is signed in and a button to sign out.
// Until the session is known it shows the link, which works without JavaScript too.
export function AccountMenu({
  signInHref,
  signInLabel,
  signOutLabel,
  signedInAs,
}: AccountMenuProps) {
  const { state, signOut } = useAuth();

  if (state.status !== "signedIn") return <a href={signInHref}>{signInLabel}</a>;

  return (
    <span className="inline-flex items-center gap-2">
      <span>{signedInAs.replace("{name}", state.user.name)}</span>
      <Button variant="secondary" size="sm" onClick={() => void signOut()}>
        {signOutLabel}
      </Button>
    </span>
  );
}
