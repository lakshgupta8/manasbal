import { notFound } from "next/navigation";

// Any address under a language with no page of its own shows that language's not-found page.
export default function UnknownPage() {
  notFound();
}
