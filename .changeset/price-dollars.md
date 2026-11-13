---
"@manasbal/ui": minor
---

`Price` takes an optional `currency` (`INR` by default, or `USD`): dollars are converted from whole paise at `DEMO_USD_RATE` (88 paise to the cent) with integer maths, rounded half up, and shown as "≈ $15.60", with "about 15 dollars 60 cents" for screen readers (words from `dollarWords`). Adds `CurrencySwitch`, a `currency` slot in `Header`, and `paiseToCents` and `formatPaiseInDollars`.
