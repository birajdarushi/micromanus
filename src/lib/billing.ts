// Paywall economics: one unlock = 5 credits, priced at $5 (charged in INR by
// default since Razorpay test accounts reliably support INR; configurable).
export const CREDITS_PER_UNLOCK = 5;
export const COUPON_CODE = process.env.COUPON_CODE ?? "SID_DRDROID";

export const MIN_CREDITS = 1;
export const MAX_CREDITS = 100;

export function paywallPrice() {
  const currency = process.env.PAYWALL_CURRENCY ?? "INR";
  // amount in smallest currency unit
  const amount = Number(process.env.PAYWALL_AMOUNT ?? (currency === "USD" ? 500 : 42500));
  const display = currency === "USD" ? "$5.00" : "₹425 (≈ $5)";
  return { currency, amount, display };
}

// Per-credit price derived from the unlock pack, used for variable top-ups.
export function perCreditAmount() {
  const { amount } = paywallPrice();
  return Math.round(amount / CREDITS_PER_UNLOCK);
}

function formatAmount(currency: string, amount: number) {
  if (currency === "USD") return `$${(amount / 100).toFixed(2)}`;
  return `₹${Math.round(amount / 100)}`;
}

// Price a variable top-up of N credits (clamped). Amount is server-authoritative;
// the chosen quantity is carried through Razorpay order notes into verify().
export function creditPurchase(quantity: number) {
  const q = Math.max(MIN_CREDITS, Math.min(MAX_CREDITS, Math.floor(quantity) || CREDITS_PER_UNLOCK));
  const { currency } = paywallPrice();
  const amount = perCreditAmount() * q;
  return { currency, amount, credits: q, display: formatAmount(currency, amount) };
}
