// Parri Plus: plans, free-tier limits and the paywall trigger.
// Pricing rationale: docs/pricing.md. Limits are enforced on the device in this version;
// production needs server-side entitlement checks (App Store / Google Play / Stripe receipts).
import { getState, updateUser, type UserData } from "./store";

export const PLANS = {
  yearly: { price: 99.99, perMonth: 8.33, trialDays: 7, label: "Год", save: 44 },
  monthly: { price: 14.99, perMonth: 14.99, trialDays: 0, label: "Месяц", save: 0 },
} as const;
export type PlanId = keyof typeof PLANS;

export const FREE_LIMITS = { scans: 3, chat: 5 }; // per week
export type Metered = keyof typeof FREE_LIMITS;

export type PaywallReason = "welcome" | "scans" | "chat" | "ai_plan" | "ai_menu" | "profile";

export function isPlus(u: UserData | null | undefined): boolean {
  const s = u?.subscription;
  if (!s) return false;
  return new Date(accessUntil(s)).getTime() > Date.now();
}

/** Canceled during the trial → access ends with the trial; otherwise with the paid period. */
export function accessUntil(s: NonNullable<UserData["subscription"]>): string {
  if (s.canceled && s.trialEndsAt && new Date(s.trialEndsAt).getTime() > Date.now()) return s.trialEndsAt;
  return s.renewsAt;
}

function weekKey(d = new Date()) {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return m.toISOString().slice(0, 10);
}

export function usage(u: UserData) {
  const w = weekKey();
  return u.usage?.week === w ? u.usage : { week: w, scans: 0, chat: 0 };
}

export function left(u: UserData, kind: Metered): number {
  return isPlus(u) ? Infinity : Math.max(0, FREE_LIMITS[kind] - usage(u)[kind]);
}

let open: ((r: PaywallReason) => void) | null = null;
export function registerPaywall(fn: ((r: PaywallReason) => void) | null) {
  open = fn;
}
export function openPaywall(reason: PaywallReason) {
  open?.(reason);
}

function current(): UserData | null {
  const s = getState();
  return s.session ? (s.data[s.session] ?? null) : null;
}

/** Returns true if the action may run now; otherwise shows the paywall. */
export function allow(kind: Metered): boolean {
  const u = current();
  if (!u || left(u, kind) > 0) return true;
  openPaywall(kind);
  return false;
}

export function consume(kind: Metered) {
  updateUser((d) => {
    if (isPlus(d)) return d;
    const u = usage(d);
    return { ...d, usage: { ...u, [kind]: u[kind] + 1 } };
  });
}

export function subscribe(plan: PlanId) {
  const now = new Date();
  const trialEnds = PLANS[plan].trialDays ? new Date(now.getTime() + PLANS[plan].trialDays * 864e5) : undefined;
  const renews = new Date(trialEnds ?? now);
  if (plan === "yearly") renews.setFullYear(renews.getFullYear() + 1);
  else renews.setMonth(renews.getMonth() + 1);
  updateUser((d) => ({
    ...d,
    subscription: { plan, startedAt: now.toISOString(), trialEndsAt: trialEnds?.toISOString(), renewsAt: renews.toISOString() },
  }));
}

export function cancel() {
  updateUser((d) => (d.subscription ? { ...d, subscription: { ...d.subscription, canceled: true } } : d));
}
