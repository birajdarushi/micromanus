// Paywall economics: one unlock = 5 credits, priced at $5 (charged in INR by
// default since Razorpay test accounts reliably support INR; configurable).
export const CREDITS_PER_UNLOCK = 5;
export const COUPON_CODE = process.env.COUPON_CODE ?? "SID_DRDROID";

export function paywallPrice() {
  const currency = process.env.PAYWALL_CURRENCY ?? "INR";
  // amount in smallest currency unit
  const amount = Number(process.env.PAYWALL_AMOUNT ?? (currency === "USD" ? 500 : 42500));
  const display = currency === "USD" ? "$5.00" : "₹425 (≈ $5)";
  return { currency, amount, display };
}
