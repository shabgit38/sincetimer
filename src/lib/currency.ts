export const currencyOptions = [
  { code: "INR", label: "INR ₹" },
  { code: "USD", label: "USD $" },
  { code: "EUR", label: "EUR €" },
  { code: "GBP", label: "GBP £" },
  { code: "AED", label: "AED د.إ" },
  { code: "SGD", label: "SGD S$" },
  { code: "AUD", label: "AUD A$" },
  { code: "CAD", label: "CAD C$" },
] as const;

export type CurrencyCode = (typeof currencyOptions)[number]["code"];

const currencyCodes = new Set<string>(currencyOptions.map((option) => option.code));

export function getCurrencyCode(value: unknown): CurrencyCode {
  if (typeof value === "string" && currencyCodes.has(value)) return value as CurrencyCode;
  return "INR";
}

export function formatMoney(amount: number, currency: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: getCurrencyCode(currency),
    maximumFractionDigits: 2,
  }).format(amount);
}
