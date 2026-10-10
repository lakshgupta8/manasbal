// Fails if a real brand appears in code, seed data or copy: the demo must never suggest
// that a real marketplace, payment network or courier is involved. A line marked
// "brand-check: allow" is exempt (e.g. naming the cloud region a service runs in).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BRANDS = [
  // Marketplaces
  "Amazon",
  "Flipkart",
  "Myntra",
  "Meesho",
  "Snapdeal",
  "Nykaa",
  "Ajio",
  "JioMart",
  "Tata Cliq",
  // Card networks and payments
  "Visa",
  "Mastercard",
  "RuPay",
  "American Express",
  "Amex",
  "UPI",
  "BHIM",
  "NPCI",
  "Paytm",
  "PhonePe",
  "Google Pay",
  "GPay",
  "Razorpay",
  "Cashfree",
  "PayU",
  "CCAvenue",
  "Stripe",
  // Couriers
  "Delhivery",
  "Blue Dart",
  "BlueDart",
  "DTDC",
  "Ecom Express",
  "Shiprocket",
  "Xpressbees",
  "Ekart",
  "India Post",
  "Shadowfax",
];
const SKIP = [/^scripts\/check-brands\.mjs$/, /^pnpm-lock\.yaml$/];
const ALLOW_MARKER = "brand-check: allow";

// "Blue Dart" also matches "BlueDart" and "Blue  Dart".
const escape = (s) =>
  s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`).replaceAll(" ", String.raw`\s*`);
const pattern = new RegExp(String.raw`\b(${BRANDS.map(escape).join("|")})\b`, "i");

// CI judges what is committed; locally, new files are checked before their first commit.
const scope = process.env.CI ? ["--cached"] : ["--cached", "--others", "--exclude-standard"];
const files = execFileSync(
  "git",
  ["ls-files", "-z", ...scope, "--", ".", ":!:**/node_modules/**"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
)
  .split("\0")
  .filter((f) => f && !SKIP.some((re) => re.test(f)));

const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in the working tree
  }
  if (text.includes("\0")) continue; // binary
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(pattern);
    if (m && !line.includes(ALLOW_MARKER)) hits.push(`${file}:${i + 1}: "${m[1]}"`);
  });
}

if (hits.length) {
  console.error(`Real brand names found (use an invented name instead):\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log(`Brand check passed: ${files.length} files, ${BRANDS.length} brands.`);
