import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAddress, listAddresses, saveAddress, type Address } from "@/lib/addresses";
import { MESSAGES } from "@/test/intl";
import { AccountProfile, AddressBook, readAddress } from "./account-pages";
import { useAuth, type AuthContextValue } from "./auth-provider";

vi.mock("./auth-provider", () => ({ useAuth: vi.fn() }));
const router = { replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/addresses", () => ({
  listAddresses: vi.fn(),
  saveAddress: vi.fn(),
  deleteAddress: vi.fn(),
}));

const WORDS = MESSAGES.en.Account;
const SIGN_IN = "/en/sign-in?next=%2Fen%2Faccount";
// Made up: no real person or place.
const USER = { id: "u1", email: "test.buyer@example.test", name: "Test Buyer", role: "customer" };
const HOME: Address = {
  id: "1a2b3c4d-0000-4000-8000-000000000001",
  name: "Test Buyer",
  line1: "12 Sample Lane",
  city: "Lakeside",
  state: "Example State",
  pincode: "190006",
  isDefault: true,
};
const WORK: Address = {
  id: "1a2b3c4d-0000-4000-8000-000000000002",
  name: "Test Office",
  line1: "4 Model Road",
  city: "Hilltown",
  state: "Example State",
  pincode: "560001",
  isDefault: false,
};

function auth(state: AuthContextValue["state"]) {
  vi.mocked(useAuth).mockReturnValue({ state, signedIn: vi.fn(), signOut: vi.fn() });
}
const signedIn = (user = USER) =>
  auth({ status: "signedIn", accessToken: "t1", expiresIn: 900, user });

// jsdom has no showModal or close (ConfirmDialog's own tests say more).
const proto = HTMLDialogElement.prototype;
const real = { showModal: proto.showModal, close: proto.close };
beforeAll(() => {
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterAll(() => {
  Object.assign(proto, real);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("AccountProfile", () => {
  const profile = (words = WORDS) => (
    <AccountProfile
      words={words}
      loading={<p>Loading the account</p>}
      signInHref={SIGN_IN}
      addressesHref="/en/account/addresses"
    />
  );

  it("waits while the session isn't known", () => {
    auth({ status: "loading" });
    render(profile());

    expect(screen.getByText("Loading the account")).toBeDefined();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in, to come back here", () => {
    auth({ status: "signedOut" });
    render(profile());

    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);
    expect(screen.getByText("Loading the account")).toBeDefined();
  });

  it("shows the name, email and role, and links to the addresses", () => {
    signedIn();
    render(profile());

    expect(screen.getByRole("heading", { level: 1, name: "Your account" })).toBeDefined();
    const facts = [...document.querySelectorAll("dt, dd")].map((cell) => cell.textContent);
    expect(facts).toEqual([
      "Name",
      "Test Buyer",
      "Email",
      "test.buyer@example.test",
      "Role",
      "Customer",
    ]);
    expect(screen.getByRole("link", { name: "Your addresses" }).getAttribute("href")).toBe(
      "/en/account/addresses",
    );
  });

  it("shows a role it has no words for as it is", () => {
    signedIn({ ...USER, role: "auditor" });
    render(profile());

    expect(screen.getByText("auditor")).toBeDefined();
  });

  it("speaks Hindi on a Hindi page", () => {
    signedIn();
    render(profile(MESSAGES.hi.Account));

    expect(screen.getByText(MESSAGES.hi.Account.roles.customer)).toBeDefined();
  });
});

const STATES = {
  loading: <p>Loading the page</p>,
  listLoading: <p>Loading the list</p>,
  loadFailed: <p>The list failed</p>,
  notice: <p>Use a made-up address</p>,
};

function book(words = WORDS) {
  return render(<AddressBook words={words} signInHref={SIGN_IN} states={STATES} />);
}

// Shows the book with this list, and lets it arrive.
async function bookWith(addresses: Address[]) {
  signedIn();
  vi.mocked(listAddresses).mockResolvedValue({ kind: "listed", addresses });
  const view = book();
  await act(async () => {});
  return view;
}

const field = (name: string) => screen.getByRole("textbox", { name: new RegExp(`^${name}`) });

function fill(
  values: Partial<Record<"Name" | "Address" | "Town or city" | "State" | "PIN code", string>>,
) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(field(label), { target: { value } });
  }
}

const FILLED = {
  Name: "  Test Buyer  ",
  Address: "12 Sample Lane",
  "Town or city": "Lakeside",
  State: "Example State",
  "PIN code": "190006",
};

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
  });
}

describe("AddressBook: getting there", () => {
  it("waits while the session isn't known", () => {
    auth({ status: "loading" });
    book();

    expect(screen.getByText("Loading the page")).toBeDefined();
    expect(listAddresses).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in, to come back here", () => {
    auth({ status: "signedOut" });
    book();

    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);
  });

  it("asks for the list with the visitor's token, and says it is loading meanwhile", async () => {
    signedIn();
    vi.mocked(listAddresses).mockReturnValue(new Promise(() => {}));
    book();

    expect(listAddresses).toHaveBeenCalledWith("t1");
    expect(screen.getByRole("heading", { level: 1, name: "Your addresses" })).toBeDefined();
    expect(screen.getByText("Loading the list")).toBeDefined();
  });

  it("sends the visitor to sign in when the token is refused", async () => {
    signedIn();
    vi.mocked(listAddresses).mockResolvedValue({ kind: "signedOut" });
    book();
    await act(async () => {});

    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);
  });

  it.each([
    ["too many tries", () => Promise.resolve({ kind: "tooManyTries" as const })],
    ["the shop out of reach", () => Promise.reject(new Error("down"))],
  ])("says the list failed to load after %s", async (_, answer) => {
    signedIn();
    vi.mocked(listAddresses).mockImplementation(answer);
    book();
    await act(async () => {});

    expect(screen.getByText("The list failed")).toBeDefined();
  });

  it("ignores a list that arrives after the page has gone", async () => {
    signedIn();
    let answer!: (value: never) => void;
    let fail!: (error: Error) => void;
    vi.mocked(listAddresses)
      .mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
      .mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    book().unmount();
    book().unmount();

    await act(async () => {
      answer({ kind: "signedOut" } as never);
      fail(new Error("down"));
    });
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("AddressBook: the list", () => {
  it("says there are none yet, with a button to add one", async () => {
    await bookWith([]);

    expect(screen.getByText("You haven't saved an address yet.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Add an address" })).toBeDefined();
  });

  it("shows each address, says which is the default, and names its buttons", async () => {
    await bookWith([HOME, WORK]);

    const cards = screen.getAllByRole("listitem");
    expect(
      cards.map((card) => within(card).getByRole("heading", { level: 2 }).textContent),
    ).toEqual(["Test Buyer", "Test Office"]);
    expect(within(cards[0]!).getByText("Default address")).toBeDefined();
    expect(within(cards[1]!).queryByText("Default address")).toBeNull();
    expect(within(cards[0]!).getByText(/Lakeside, Example State 190006/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit Test Office, 4 Model Road" }).textContent).toBe(
      "Edit",
    );
    expect(
      screen.getByRole("button", { name: "Delete Test Buyer, 12 Sample Lane" }).textContent,
    ).toBe("Delete");
  });
});

describe("AddressBook: adding and changing", () => {
  it("opens an empty form with the notice, focus on the first field", async () => {
    await bookWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));

    const form = screen.getByRole("form", { name: "Add an address" });
    expect(within(form).getByText("Use a made-up address")).toBeDefined();
    expect(document.activeElement).toBe(field("Name"));
    expect((field("Name") as HTMLInputElement).value).toBe("");
    expect((field("PIN code") as HTMLInputElement).maxLength).toBe(6);
    expect((field("PIN code") as HTMLInputElement).inputMode).toBe("numeric");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("says what is missing next to each field, and moves to the first", async () => {
    await bookWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
    field("PIN code").focus();
    await submit();

    for (const message of [
      WORDS.nameMissing,
      WORDS.line1Missing,
      WORDS.cityMissing,
      WORDS.stateMissing,
      WORDS.pincodeInvalid,
    ]) {
      expect(screen.getByText(message)).toBeDefined();
    }
    expect(document.activeElement).toBe(field("Name"));
    expect(saveAddress).not.toHaveBeenCalled();
  });

  it.each(["12345", "1234567", "012345", "12a456"])(
    "wants a 6-digit PIN code not starting with 0, not %s",
    async (pincode) => {
      await bookWith([]);
      fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
      fill({ ...FILLED, "PIN code": pincode });
      await submit();

      expect(screen.getByText(WORDS.pincodeInvalid)).toBeDefined();
      expect(document.activeElement).toBe(field("PIN code"));
    },
  );

  it("adds the address, reads the list again, and says so", async () => {
    await bookWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
    fill(FILLED);
    fireEvent.click(screen.getByRole("checkbox"));
    vi.mocked(saveAddress).mockResolvedValue({ kind: "saved", address: HOME });
    vi.mocked(listAddresses).mockResolvedValue({ kind: "listed", addresses: [HOME] });
    await submit();

    expect(saveAddress).toHaveBeenCalledWith(
      "t1",
      {
        name: "Test Buyer",
        line1: "12 Sample Lane",
        city: "Lakeside",
        state: "Example State",
        pincode: "190006",
        isDefault: true,
      },
      undefined,
    );
    expect(screen.getByRole("status").textContent).toBe("Address saved.");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("changes the address being edited, starting from what it holds", async () => {
    await bookWith([HOME, WORK]);
    fireEvent.click(screen.getByRole("button", { name: "Edit Test Office, 4 Model Road" }));

    expect(screen.getByRole("form", { name: "Edit the address" })).toBeDefined();
    expect((field("Address") as HTMLInputElement).value).toBe("4 Model Road");
    fill({ "Town or city": "Rivertown" });
    vi.mocked(saveAddress).mockResolvedValue({ kind: "saved", address: WORK });
    // The list fails to arrive again: the old one stays.
    vi.mocked(listAddresses).mockResolvedValue({ kind: "tooManyTries" });
    await submit();

    expect(vi.mocked(saveAddress).mock.calls[0]![1].city).toBe("Rivertown");
    expect(vi.mocked(saveAddress).mock.calls[0]![2]).toBe(WORK.id);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("Address saved.");
  });

  it("starts an edit with the default box ticked for the default address", async () => {
    await bookWith([HOME]);
    fireEvent.click(screen.getByRole("button", { name: "Edit Test Buyer, 12 Sample Lane" }));

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it.each([
    [{ kind: "invalid" as const }, WORDS.invalid],
    [{ kind: "gone" as const }, WORDS.gone],
  ])("explains a refused save in an alert, and keeps the form", async (outcome, message) => {
    await bookWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
    fill(FILLED);
    vi.mocked(saveAddress).mockResolvedValue(outcome);
    await submit();

    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(screen.getByRole("form")).toBeDefined();
  });

  it("waits as long as the API says after too many tries", async () => {
    await bookWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
    fill(FILLED);
    vi.mocked(saveAddress).mockResolvedValue({ kind: "tooManyTries", retryAfterSeconds: 120 });
    await submit();

    expect(screen.getByRole("alert").textContent).toContain("2 minutes");
    expect(
      (screen.getByRole("button", { name: "Save address" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("sends the visitor to sign in when the token is refused", async () => {
    await bookWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
    fill(FILLED);
    vi.mocked(saveAddress).mockResolvedValue({ kind: "signedOut" });
    await submit();

    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);
  });

  it("says when the shop can't be reached", async () => {
    await bookWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
    fill(FILLED);
    vi.mocked(saveAddress).mockRejectedValue(new TypeError("fetch failed"));
    await submit();

    expect(screen.getByRole("alert").textContent).toBe(WORDS.unavailable);
  });

  it("goes back to the list on Cancel, with focus on its heading and no alert", async () => {
    await bookWith([HOME]);
    fireEvent.click(screen.getByRole("button", { name: "Add an address" }));
    fill(FILLED);
    vi.mocked(saveAddress).mockResolvedValue({ kind: "invalid" });
    await submit();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });
});

describe("AddressBook: deleting", () => {
  const dialog = () => screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;

  async function askToDelete() {
    await bookWith([HOME, WORK]);
    fireEvent.click(screen.getByRole("button", { name: "Delete Test Office, 4 Model Road" }));
  }

  async function confirm() {
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: "Delete" }));
    });
  }

  it("asks first, naming the address", async () => {
    await askToDelete();

    expect(dialog().open).toBe(true);
    expect(within(dialog()).getByRole("heading").textContent).toBe("Delete this address?");
    expect(
      within(dialog()).getByText("Test Office, 4 Model Road will be removed from your addresses."),
    ).toBeDefined();
    expect(document.activeElement).toBe(within(dialog()).getByRole("button", { name: "Keep it" }));
  });

  it("keeps the address with Keep it, and with Esc", async () => {
    await askToDelete();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Keep it" }));
    expect(dialog().open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Delete Test Office, 4 Model Road" }));
    dialog().dispatchEvent(new Event("cancel", { cancelable: true }));
    await act(async () => {});
    expect(dialog().open).toBe(false);

    expect(deleteAddress).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("deletes it once confirmed, and says so", async () => {
    await askToDelete();
    vi.mocked(deleteAddress).mockResolvedValue({ kind: "deleted" });
    await confirm();

    expect(deleteAddress).toHaveBeenCalledWith("t1", WORK.id);
    expect(dialog().open).toBe(false);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Address deleted.");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("keeps an address an order was sent to, and says why", async () => {
    await askToDelete();
    vi.mocked(deleteAddress).mockResolvedValue({ kind: "inUse" });
    await confirm();

    expect(screen.getByRole("alert").textContent).toBe(WORDS.inUse);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("sends the visitor to sign in when the token is refused", async () => {
    await askToDelete();
    vi.mocked(deleteAddress).mockResolvedValue({ kind: "signedOut" });
    await confirm();

    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);
  });

  it("says when the shop can't be reached", async () => {
    await askToDelete();
    vi.mocked(deleteAddress).mockRejectedValue(new TypeError("fetch failed"));
    await confirm();

    expect(screen.getByRole("alert").textContent).toBe(WORDS.unavailable);
  });
});

describe("readAddress", () => {
  it("trims each field and reads the default box", () => {
    const data = new FormData();
    for (const [key, value] of Object.entries({
      name: " A ",
      line1: " B ",
      city: " C ",
      state: " D ",
      pincode: " 110001 ",
    })) {
      data.set(key, value);
    }

    expect(readAddress(WORDS, data).input).toEqual({
      name: "A",
      line1: "B",
      city: "C",
      state: "D",
      pincode: "110001",
      isDefault: false,
    });
  });
});

describe("AddressBook in Hindi", () => {
  beforeEach(() => {
    signedIn();
    vi.mocked(listAddresses).mockResolvedValue({ kind: "listed", addresses: [] });
  });

  it("speaks Hindi on a Hindi page", async () => {
    book(MESSAGES.hi.Account);
    await act(async () => {});

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      MESSAGES.hi.Account.addressesTitle,
    );
    expect(screen.getByText(MESSAGES.hi.Account.noAddresses)).toBeDefined();
  });
});
