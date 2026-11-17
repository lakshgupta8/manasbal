"use client";

import { Button, Checkbox, ConfirmDialog, TextField } from "@manasbal/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  deleteAddress,
  listAddresses,
  saveAddress,
  type Address,
  type AddressInput,
  type Refusal,
} from "@/lib/addresses";
import type en from "../../messages/en.json";
import { FormAlert } from "./auth-form-parts";
import { useAuth } from "./auth-provider";
import { useFormAlert } from "./use-form-alert";

// The account pages' browser side, as one module: both pages get the same chunk. Every word is
// translated on the server and passed in, and so is everything that never changes in the
// browser (the loading and error states, the notice), which keeps their code on the server. What
// the pages show comes from the API with the access token the auth context keeps in memory, so
// nothing about the visitor is in the page's HTML.

export type AccountWords = typeof en.Account;

// The signed-in state, or null while it isn't known or the visitor is being sent to sign in
// (and back to this page afterwards).
function useSignedIn(signInHref: string) {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "signedOut") router.replace(signInHref);
  }, [state.status, router, signInHref]);
  return state.status === "signedIn" ? state : null;
}

export interface AccountProfileProps {
  readonly words: AccountWords;
  // Shown until the session is known, and while a signed-out visitor is sent to sign in.
  readonly loading: ReactNode;
  readonly signInHref: string;
  readonly addressesHref: string;
}

// Who is signed in: name, email and role (from GET /me, which the auth context asked on sign-in),
// and the account's other pages.
export function AccountProfile({ words, loading, signInHref, addressesHref }: AccountProfileProps) {
  const signedIn = useSignedIn(signInHref);
  if (signedIn === null) return loading;
  const { user } = signedIn;
  const roles: Readonly<Record<string, string>> = words.roles;

  return (
    <>
      <h1 className="font-semibold text-heading-2">{words.title}</h1>
      <dl className="gap-x-6 gap-y-2 grid grid-cols-[max-content_1fr] text-body">
        <dt className="text-text-muted">{words.name}</dt>
        <dd>{user.name}</dd>
        <dt className="text-text-muted">{words.email}</dt>
        <dd className="break-all">{user.email}</dd>
        <dt className="text-text-muted">{words.role}</dt>
        <dd>{roles[user.role] ?? user.role}</dd>
      </dl>
      <ul className="flex flex-col gap-2">
        <li>
          <a href={addressesHref} className="text-text-action underline">
            {words.addressesLink}
          </a>
        </li>
      </ul>
    </>
  );
}

// One line for an address, as the dialog and the buttons' names say it.
const summary = (address: Address) => `${address.name}, ${address.line1}`;

type Field = "name" | "line1" | "city" | "state" | "pincode";
export type AddressErrors = Partial<Record<Field, string>>;
const FIELDS: readonly Field[] = ["name", "line1", "city", "state", "pincode"];
// The API's limits (addressInputSchema), so the form can't send more.
const MAX_LENGTH: Readonly<Record<Field, number>> = {
  name: 100,
  line1: 200,
  city: 100,
  state: 100,
  pincode: 6,
};

// The form's fields as the API takes them, or what is wrong with them. The same rules as
// addressInputSchema, checked here first so each problem is said next to its field.
export function readAddress(
  words: AccountWords,
  data: FormData,
): { readonly input?: AddressInput; readonly errors: AddressErrors } {
  const text = (field: Field) => (data.get(field) as string).trim();
  const errors: AddressErrors = {};
  if (text("name") === "") errors.name = words.nameMissing;
  if (text("line1") === "") errors.line1 = words.line1Missing;
  if (text("city") === "") errors.city = words.cityMissing;
  if (text("state") === "") errors.state = words.stateMissing;
  if (!/^[1-9]\d{5}$/.test(text("pincode"))) errors.pincode = words.pincodeInvalid;
  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    input: {
      name: text("name"),
      line1: text("line1"),
      city: text("city"),
      state: text("state"),
      pincode: text("pincode"),
      isDefault: data.get("isDefault") === "on",
    },
  };
}

interface AddressFormProps {
  readonly words: AccountWords;
  // "Use a made-up address", drawn on the server.
  readonly notice: ReactNode;
  // The address being changed, or undefined for a new one.
  readonly address?: Address;
  readonly busy: boolean;
  readonly waiting: boolean;
  readonly onSave: (input: AddressInput) => void;
  readonly onCancel: () => void;
}

// Adding or changing one address. The labels always show; each problem is said in words, with
// an icon, next to its field, and focus moves to the first one.
function AddressForm({
  words,
  notice,
  address,
  busy,
  waiting,
  onSave,
  onCancel,
}: AddressFormProps) {
  const form = useRef<HTMLFormElement>(null);
  const headingId = useId();
  const [errors, setErrors] = useState<AddressErrors>({});

  // The first field has focus when the form opens.
  useEffect(() => {
    (form.current!.elements.namedItem("name") as HTMLInputElement).focus();
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { input, errors: found } = readAddress(words, new FormData(event.currentTarget));
    setErrors(found);
    if (input !== undefined) return onSave(input);
    const first = FIELDS.find((field) => found[field] !== undefined)!;
    (form.current!.elements.namedItem(first) as HTMLInputElement).focus();
  }

  return (
    <form
      ref={form}
      noValidate
      aria-labelledby={headingId}
      aria-busy={busy}
      onSubmit={onSubmit}
      className="flex flex-col gap-4 max-w-xl"
    >
      <h2 id={headingId} className="font-semibold text-heading-3">
        {address === undefined ? words.addTitle : words.editTitle}
      </h2>
      {notice}
      {FIELDS.map((field) => (
        <TextField
          key={field}
          name={field}
          label={words[field === "name" ? "fullName" : field]}
          hint={field === "pincode" ? words.pincodeHint : undefined}
          inputMode={field === "pincode" ? "numeric" : undefined}
          autoComplete="off"
          required
          requiredText={words.required}
          maxLength={MAX_LENGTH[field]}
          defaultValue={address?.[field]}
          error={errors[field]}
        />
      ))}
      <Checkbox
        name="isDefault"
        label={words.makeDefault}
        defaultChecked={address?.isDefault ?? false}
      />
      <div className="flex flex-wrap gap-3 mt-2">
        <Button type="submit" disabled={busy || waiting}>
          {words.save}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {words.cancel}
        </Button>
      </div>
    </form>
  );
}

// Drawn on the server: the page loading, the list loading, the list failing to load (with a
// link to try again), and the form's notice.
export interface AddressStates {
  readonly loading: ReactNode;
  readonly listLoading: ReactNode;
  readonly loadFailed: ReactNode;
  readonly notice: ReactNode;
}

export interface AddressBookProps {
  readonly words: AccountWords;
  readonly signInHref: string;
  readonly states: AddressStates;
}

// What the page is doing besides showing the list: adding ("new"), changing one, or nothing.
type Editing = "new" | Address | null;

// The signed-in visitor's addresses: the list, then a form to add or change one, and a dialog
// that asks before deleting one. A result is said in a status line; a problem in an alert.
export function AddressBook({ words, signInHref, states }: AddressBookProps) {
  const signedIn = useSignedIn(signInHref);
  const router = useRouter();
  const accessToken = signedIn?.accessToken;
  const heading = useRef<HTMLHeadingElement>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  // Counts the results that move focus to the heading. The move waits for the render: while the
  // delete dialog is open the rest of the page is inert and can't take focus, and the dialog only
  // closes as the render finishes.
  const [results, setResults] = useState(0);
  const { alert, waiting, show, tooManyTries } = useFormAlert(words);

  useEffect(() => {
    if (results > 0) heading.current!.focus();
  }, [results]);

  useEffect(() => {
    if (accessToken === undefined) return;
    let current = true;
    listAddresses(accessToken).then(
      (outcome) => {
        if (!current) return;
        if (outcome.kind === "listed") setAddresses(outcome.addresses);
        else if (outcome.kind === "signedOut") router.replace(signInHref);
        else setLoadFailed(true);
      },
      () => {
        if (current) setLoadFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [accessToken, router, signInHref]);

  // A refused call: sign in again, or wait.
  function refused(outcome: Refusal) {
    if (outcome.kind === "signedOut") router.replace(signInHref);
    else tooManyTries(outcome.retryAfterSeconds);
  }

  // Back to the list, focus on its heading, with the result said in the status line.
  function done(message: string, list: Address[]) {
    setAddresses(list);
    setEditing(null);
    setStatus(message);
    setResults((count) => count + 1);
  }

  // Runs one change; the API being out of reach is said in the alert.
  async function run(change: () => Promise<void>) {
    setBusy(true);
    show(null);
    setStatus("");
    try {
      await change();
    } catch {
      show(words.unavailable);
    } finally {
      setBusy(false);
    }
  }

  const save = (input: AddressInput) =>
    run(async () => {
      const id = editing === "new" ? undefined : editing!.id;
      const outcome = await saveAddress(accessToken!, input, id);
      if (outcome.kind === "saved") {
        // The API keeps one default and sorts the list, so read it again.
        const listed = await listAddresses(accessToken!);
        return done(words.saved, listed.kind === "listed" ? listed.addresses : addresses!);
      }
      if (outcome.kind === "invalid") return show(words.invalid);
      if (outcome.kind === "gone") return show(words.gone);
      refused(outcome);
    });

  const remove = (address: Address) =>
    run(async () => {
      const outcome = await deleteAddress(accessToken!, address.id);
      setDeleting(null);
      if (outcome.kind === "deleted") {
        return done(
          words.deleted,
          addresses!.filter((other) => other.id !== address.id),
        );
      }
      if (outcome.kind === "inUse") return show(words.inUse);
      refused(outcome);
    });

  if (signedIn === null) return states.loading;

  let main: ReactNode;
  if (editing !== null) {
    main = (
      <AddressForm
        words={words}
        notice={states.notice}
        address={editing === "new" ? undefined : editing}
        busy={busy}
        waiting={waiting}
        onSave={(input) => void save(input)}
        onCancel={() => {
          setEditing(null);
          show(null);
          heading.current!.focus();
        }}
      />
    );
  } else if (loadFailed) main = states.loadFailed;
  else if (addresses === null) main = states.listLoading;
  else {
    main = (
      <AddressList
        words={words}
        addresses={addresses}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
        onDelete={setDeleting}
      />
    );
  }

  return (
    <>
      <h1 ref={heading} tabIndex={-1} className="font-semibold text-heading-2 focus:outline-none">
        {words.addressesTitle}
      </h1>
      {alert !== null && <FormAlert>{alert}</FormAlert>}
      <output className="text-body empty:hidden">{status}</output>
      {main}
      <ConfirmDialog
        open={deleting !== null}
        title={words.deleteTitle}
        confirmLabel={words.deleteConfirm}
        cancelLabel={words.keep}
        busy={busy}
        onConfirm={() => void remove(deleting!)}
        onCancel={() => setDeleting(null)}
      >
        {deleting !== null && <p>{words.deleteBody.replace("{address}", summary(deleting))}</p>}
      </ConfirmDialog>
    </>
  );
}

interface AddressListProps {
  readonly words: AccountWords;
  readonly addresses: readonly Address[];
  readonly onAdd: () => void;
  readonly onEdit: (address: Address) => void;
  readonly onDelete: (address: Address) => void;
}

function AddressList({ words, addresses, onAdd, onEdit, onDelete }: AddressListProps) {
  return (
    <>
      <div>
        <Button onClick={onAdd}>{words.add}</Button>
      </div>
      {addresses.length === 0 ? (
        <p className="text-body text-text-muted">{words.noAddresses}</p>
      ) : (
        <ul className="gap-4 grid md:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 p-4 border border-border-strong rounded-lg text-body"
            >
              <h2 className="font-semibold">{address.name}</h2>
              <p>
                {address.line1}
                <br />
                {address.city}, {address.state} {address.pincode}
              </p>
              {address.isDefault && <p className="font-medium">{words.isDefault}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={words.editNamed.replace("{address}", summary(address))}
                  onClick={() => onEdit(address)}
                >
                  {words.edit}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={words.deleteNamed.replace("{address}", summary(address))}
                  onClick={() => onDelete(address)}
                >
                  {words.delete}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
