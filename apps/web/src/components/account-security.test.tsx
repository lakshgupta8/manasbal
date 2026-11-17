import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { endSession, listSessions, type SignedInBrowser } from "@/lib/sessions";
import { disableTwoStep, enableTwoStep, startTwoStep } from "@/lib/two-step";
import { MESSAGES } from "@/test/intl";
import { SessionList, TwoStepSettings } from "./account-security";
import { useAuth, type AuthContextValue } from "./auth-provider";

vi.mock("./auth-provider", () => ({ useAuth: vi.fn() }));
const router = { replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/sessions", () => ({ listSessions: vi.fn(), endSession: vi.fn() }));
vi.mock("@/lib/two-step", () => ({
  startTwoStep: vi.fn(),
  enableTwoStep: vi.fn(),
  disableTwoStep: vi.fn(),
}));
// The QR code has its own tests; here it only shows what it would hold.
vi.mock("./qr-code", () => ({
  QrCode: ({ text, label }: { text: string; label: string }) => (
    <svg role="img" aria-label={label} data-text={text} />
  ),
}));

const WORDS = MESSAGES.en.Account;
const SIGN_IN = "/en/sign-in?next=%2Fen%2Faccount%2Fsessions";
// Made up: no real person.
const USER = {
  id: "u1",
  email: "test.buyer@example.test",
  name: "Test Buyer",
  role: "customer",
  twoStep: false,
};
const THIS_ONE: SignedInBrowser = {
  id: "5e550000-0000-4000-8000-000000000001",
  browser: "Firefox on Linux",
  startedAt: "2026-11-01T10:00:00.000Z",
  lastUsedAt: "2026-11-17T09:30:00.000Z",
  current: true,
};
const OTHER: SignedInBrowser = {
  id: "5e550000-0000-4000-8000-000000000002",
  browser: "Chrome on Android",
  startedAt: "2026-10-20T08:00:00.000Z",
  lastUsedAt: "2026-11-16T18:45:00.000Z",
  current: false,
};
// Made up: not a key anyone uses.
const SETUP = {
  otpauthUrl: "otpauth://totp/Manasbal:test.buyer%40example.test?secret=JBSWY3DPEHPK3PXP",
  secret: "JBSWY3DPEHPK3PXP",
};
const CODES = ["aaaaa-bbbbb", "ccccc-ddddd"];

const signOut = vi.fn(async () => undefined);
const refreshUser = vi.fn(async () => undefined);
function auth(state: AuthContextValue["state"]) {
  vi.mocked(useAuth).mockReturnValue({ state, signedIn: vi.fn(), signOut, refreshUser });
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
});

const status = () => document.querySelector("output")!.textContent;
const heading = () => screen.getByRole("heading", { level: 1 });
const click = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });

const STATES = {
  loading: <p>Loading the page</p>,
  listLoading: <p>Loading the list</p>,
  loadFailed: <p>The list failed</p>,
};

function list() {
  return render(<SessionList words={WORDS} locale="en" signInHref={SIGN_IN} states={STATES} />);
}

async function listWith(sessions: SignedInBrowser[]) {
  signedIn();
  vi.mocked(listSessions).mockResolvedValue({ kind: "listed", items: sessions });
  const view = list();
  await act(async () => {});
  return view;
}

describe("SessionList: getting there", () => {
  it("waits while the session isn't known", () => {
    auth({ status: "loading" });
    list();

    expect(screen.getByText("Loading the page")).toBeDefined();
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("asks for the list with the visitor's token, and says it is loading meanwhile", () => {
    signedIn();
    vi.mocked(listSessions).mockReturnValue(new Promise(() => {}));
    list();

    expect(listSessions).toHaveBeenCalledWith("t1");
    expect(heading().textContent).toBe(WORDS.sessionsTitle);
    expect(screen.getByText(WORDS.sessionsIntro)).toBeDefined();
    expect(screen.getByText("Loading the list")).toBeDefined();
  });

  it("sends the visitor to sign in when the token is refused", async () => {
    signedIn();
    vi.mocked(listSessions).mockResolvedValue({ kind: "signedOut" });
    list();
    await act(async () => {});

    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);
  });

  it("says when the list can't be loaded", async () => {
    signedIn();
    vi.mocked(listSessions).mockRejectedValue(new Error("offline"));
    list();
    await act(async () => {});

    expect(screen.getByText("The list failed")).toBeDefined();
  });
});

describe("SessionList: the list", () => {
  it("shows each browser, marks this one, and says when each was used", async () => {
    await listWith([THIS_ONE, OTHER]);

    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first!).getByRole("heading", { level: 2 }).textContent).toBe(
      "Firefox on Linux (This device)",
    );
    expect(within(second!).getByRole("heading", { level: 2 }).textContent).toBe(
      "Chrome on Android",
    );
    const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
    expect(
      within(first!).getByText(`Signed in ${when.format(new Date(THIS_ONE.startedAt))}`),
    ).toBeDefined();
    expect(
      within(first!).getByText(`Last used ${when.format(new Date(THIS_ONE.lastUsedAt))}`),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "End session: Chrome on Android" }).textContent).toBe(
      "End session",
    );
  });
});

describe("SessionList: ending a session", () => {
  it("asks first, naming the browser, and keeps it with Keep it", async () => {
    await listWith([THIS_ONE, OTHER]);

    await click("End session: Chrome on Android");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Chrome on Android will be signed out.")).toBeDefined();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Keep it" }));
    });
    expect(endSession).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ends another browser's session once confirmed, and says so", async () => {
    await listWith([THIS_ONE, OTHER]);
    vi.mocked(endSession).mockResolvedValue({ kind: "ended" });

    await click("End session: Chrome on Android");
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "End session" }),
      );
    });

    expect(endSession).toHaveBeenCalledWith("t1", OTHER.id);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(status()).toBe("Session ended.");
    expect(document.activeElement).toBe(heading());
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs this browser out when its own session is ended", async () => {
    await listWith([THIS_ONE, OTHER]);
    vi.mocked(endSession).mockResolvedValue({ kind: "ended" });

    await click("End session: Firefox on Linux");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(WORDS.endCurrentBody)).toBeDefined();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "End session" }));
    });

    expect(endSession).toHaveBeenCalledWith("t1", THIS_ONE.id);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("sends the visitor to sign in when the token is refused, or says to wait", async () => {
    await listWith([THIS_ONE, OTHER]);
    vi.mocked(endSession).mockResolvedValueOnce({ kind: "signedOut" });

    await click("End session: Chrome on Android");
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "End session" }),
      );
    });
    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);

    vi.mocked(endSession).mockResolvedValueOnce({ kind: "tooManyTries" });
    await click("End session: Chrome on Android");
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "End session" }),
      );
    });
    expect(screen.getByRole("alert").textContent).toBe(WORDS.tooManyTries);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("says when the shop can't be reached", async () => {
    await listWith([THIS_ONE, OTHER]);
    vi.mocked(endSession).mockRejectedValue(new Error("offline"));

    await click("End session: Chrome on Android");
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "End session" }),
      );
    });

    expect(screen.getByRole("alert").textContent).toBe(WORDS.unavailable);
  });
});

const TWO_STEP_STATES = {
  loading: <p>Loading the page</p>,
  demo: <p>Off for demo logins</p>,
};

function settings() {
  return render(<TwoStepSettings words={WORDS} signInHref={SIGN_IN} states={TWO_STEP_STATES} />);
}

const codeBox = () =>
  screen.getByRole("textbox", { name: new RegExp(`^${WORDS.codeLabel}`) }) as HTMLInputElement;

async function sendCode(value: string, button: string) {
  fireEvent.change(codeBox(), { target: { value } });
  await click(button);
}

// Signed in with two-step off, set-up started: the secret on screen.
async function startSetUp() {
  signedIn();
  vi.mocked(startTwoStep).mockResolvedValue({ kind: "started", setup: SETUP });
  settings();
  await click("Switch on");
}

describe("TwoStepSettings: getting there", () => {
  it("waits while the session isn't known", () => {
    auth({ status: "loading" });
    settings();

    expect(screen.getByText("Loading the page")).toBeDefined();
  });

  it("says it is off, with a button to switch it on, and asks the API nothing yet", () => {
    signedIn();
    settings();

    expect(heading().textContent).toBe(WORDS.twoStepTitle);
    expect(screen.getByText(WORDS.twoStepIntro)).toBeDefined();
    expect(screen.getByText(WORDS.twoStepIsOff)).toBeDefined();
    expect(screen.getByRole("button", { name: "Switch on" })).toBeDefined();
    expect(startTwoStep).not.toHaveBeenCalled();
  });

  it("shows a demo login the message and no switch", () => {
    signedIn({ ...USER, email: " Customer@Example.com " });
    settings();

    expect(screen.getByText("Off for demo logins")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the message when the API says it is a demo login", async () => {
    signedIn();
    vi.mocked(startTwoStep).mockResolvedValue({ kind: "demo" });
    settings();

    await click("Switch on");

    expect(screen.getByText("Off for demo logins")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("TwoStepSettings: switching on", () => {
  it("shows the secret as a QR code and as text, then the code box", async () => {
    await startSetUp();

    expect(startTwoStep).toHaveBeenCalledWith("t1");
    expect(screen.getByRole("heading", { level: 2, name: WORDS.setupTitle })).toBeDefined();
    const qr = screen.getByRole("img", { name: WORDS.qrLabel });
    expect(qr.getAttribute("data-text")).toBe(SETUP.otpauthUrl);
    expect(document.querySelector("code")!.textContent).toBe("JBSW Y3DP EHPK 3PXP");
    expect(codeBox().getAttribute("autocomplete")).toBe("one-time-code");
    expect(codeBox().getAttribute("inputmode")).toBe("numeric");
    // Switching on needs the app: no recovery codes exist yet.
    expect(screen.queryByRole("button", { name: WORDS.useRecoveryCode })).toBeNull();
    expect(status()).toBe("");
  });

  it("says a wrong code, with the field focused, and stays on set-up", async () => {
    await startSetUp();
    vi.mocked(enableTwoStep).mockResolvedValue({ kind: "wrongCode" });

    await sendCode("123 456", WORDS.confirmOn);

    expect(enableTwoStep).toHaveBeenCalledWith("t1", "123456");
    expect(screen.getByText(WORDS.wrongCode)).toBeDefined();
    expect(document.activeElement).toBe(codeBox());
    expect(screen.getByRole("img", { name: WORDS.qrLabel })).toBeDefined();
  });

  it("says how long to wait after too many tries", async () => {
    await startSetUp();
    vi.mocked(enableTwoStep).mockResolvedValue({ kind: "tooManyTries" });

    await sendCode("123456", WORDS.confirmOn);

    expect(screen.getByRole("alert").textContent).toBe(WORDS.tooManyTries);
  });

  it("switches on, then shows the recovery codes once, then drops them", async () => {
    await startSetUp();
    vi.mocked(enableTwoStep).mockResolvedValue({ kind: "on", recoveryCodes: CODES });

    await sendCode("123456", WORDS.confirmOn);

    expect(refreshUser).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 2, name: WORDS.codesTitle })).toBeDefined();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(CODES);
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.activeElement).toBe(heading());

    await click(WORDS.codesDone);

    expect(refreshUser).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(CODES[0]!)).toBeNull();
    expect(status()).toBe(WORDS.twoStepIsOn);
  });

  it("goes back without switching on, on Cancel", async () => {
    await startSetUp();

    await click(WORDS.cancel);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(WORDS.twoStepIsOff)).toBeDefined();
    expect(enableTwoStep).not.toHaveBeenCalled();
  });

  it("shows how it is now when it was switched on somewhere else", async () => {
    signedIn();
    vi.mocked(startTwoStep).mockResolvedValue({ kind: "alreadyOn" });
    settings();

    await click("Switch on");

    expect(refreshUser).toHaveBeenCalledOnce();
    expect(status()).toBe(WORDS.changedElsewhere);
  });

  it("shows how it is now when it changed elsewhere while setting up", async () => {
    await startSetUp();
    vi.mocked(enableTwoStep).mockResolvedValue({ kind: "changed" });

    await sendCode("123456", WORDS.confirmOn);

    expect(refreshUser).toHaveBeenCalledOnce();
    expect(status()).toBe(WORDS.changedElsewhere);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("sends the visitor to sign in when the token is refused", async () => {
    await startSetUp();
    vi.mocked(enableTwoStep).mockResolvedValue({ kind: "signedOut" });

    await sendCode("123456", WORDS.confirmOn);

    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);
  });

  it("sends the visitor to sign in, or says to wait, when starting is refused", async () => {
    signedIn();
    vi.mocked(startTwoStep).mockResolvedValueOnce({ kind: "signedOut" });
    settings();

    await click("Switch on");
    expect(router.replace).toHaveBeenCalledWith(SIGN_IN);

    vi.mocked(startTwoStep).mockResolvedValueOnce({ kind: "tooManyTries" });
    await click("Switch on");
    expect(screen.getByRole("alert").textContent).toBe(WORDS.tooManyTries);
  });

  it("says when the shop can't be reached", async () => {
    signedIn();
    vi.mocked(startTwoStep).mockRejectedValue(new Error("offline"));
    settings();

    await click("Switch on");

    expect(screen.getByRole("alert").textContent).toBe(WORDS.unavailable);
  });
});

describe("TwoStepSettings: switching off", () => {
  it("says it is on, and switches off with a code from the app", async () => {
    signedIn({ ...USER, twoStep: true });
    vi.mocked(disableTwoStep).mockResolvedValue({ kind: "off" });
    settings();

    expect(screen.getByText(WORDS.twoStepIsOn)).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: WORDS.switchOffTitle })).toBeDefined();
    await sendCode("654321", WORDS.switchOff);

    expect(disableTwoStep).toHaveBeenCalledWith("t1", "654321");
    expect(refreshUser).toHaveBeenCalledOnce();
    expect(status()).toBe(WORDS.twoStepIsOff);
    expect(document.activeElement).toBe(heading());
  });

  it("takes a recovery code instead, and says when it is wrong", async () => {
    signedIn({ ...USER, twoStep: true });
    vi.mocked(disableTwoStep).mockResolvedValue({ kind: "wrongCode" });
    settings();

    await click(WORDS.useRecoveryCode);
    const box = screen.getByRole("textbox", { name: new RegExp(`^${WORDS.recoveryLabel}`) });
    fireEvent.change(box, { target: { value: "aaaaa-bbbbb" } });
    await click(WORDS.switchOff);

    expect(disableTwoStep).toHaveBeenCalledWith("t1", "aaaaa-bbbbb");
    expect(screen.getByText(WORDS.wrongRecoveryCode)).toBeDefined();
    expect(refreshUser).not.toHaveBeenCalled();
  });
});

describe("in Hindi", () => {
  it("speaks Hindi on a Hindi page", () => {
    signedIn();
    render(
      <TwoStepSettings words={MESSAGES.hi.Account} signInHref={SIGN_IN} states={TWO_STEP_STATES} />,
    );

    expect(heading().textContent).toBe(MESSAGES.hi.Account.twoStepTitle);
    expect(screen.getByRole("button", { name: MESSAGES.hi.Account.switchOn })).toBeDefined();
  });
});
