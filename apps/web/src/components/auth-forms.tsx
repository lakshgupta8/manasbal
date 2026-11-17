"use client";

// The sign-in forms and the account pages, as one client module: each page that shows one gets
// the same chunk, rather than its own copy of the fields and form pieces they share (text fields,
// checkbox, alerts). A sign-in page loads the account pages' code too (about 4 kB); one shared
// copy keeps the shop's whole client code under its 200 kB budget.
export { AccountProfile, AddressBook } from "./account-pages";
export { ForgotPasswordForm } from "./forgot-password-form";
export { ResetPasswordForm } from "./reset-password-form";
export { SignInForm } from "./sign-in-form";
export { SignUpForm } from "./sign-up-form";
export { VerifyEmail } from "./verify-email";
