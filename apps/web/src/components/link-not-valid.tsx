import { Button } from "@manasbal/ui";
import { useRouter } from "next/navigation";
import { CardLink } from "./auth-form-parts";

export interface LinkNotValidWords {
  readonly invalidTitle: string;
  readonly invalidBody: string;
  readonly askForNewLink: string;
  readonly backToSignIn: string;
}

export interface LinkNotValidProps {
  readonly words: LinkNotValidWords;
  // Where a new link comes from: the forgotten-password page.
  readonly newLinkHref: string;
  readonly signInHref: string;
}

// What a used, expired or unknown link from a mail shows (the confirm-email and reset-password
// pages): the words, a way to a new link and a way back to sign-in.
export function LinkNotValid({ words, newLinkHref, signInHref }: LinkNotValidProps) {
  const router = useRouter();
  return (
    <>
      <h1 className="font-semibold text-heading-2">{words.invalidTitle}</h1>
      <p>{words.invalidBody}</p>
      <Button className="w-full" onClick={() => router.push(newLinkHref)}>
        {words.askForNewLink}
      </Button>
      <div>
        <CardLink href={signInHref}>{words.backToSignIn}</CardLink>
      </div>
    </>
  );
}
