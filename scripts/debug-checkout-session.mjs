// Temporary debug helper: inspects a Stripe Checkout session + Supabase rows
// to diagnose why post-payment activation is stuck. Usage:
//   node scripts/debug-checkout-session.mjs <checkout_session_id>
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("usage: node scripts/debug-checkout-session.mjs <session_id>");
  process.exit(1);
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const session = await stripe.checkout.sessions.retrieve(sessionId, {
  expand: ["line_items.data.price", "subscription", "customer"],
});

console.log("=== checkout session ===");
console.log({
  id: session.id,
  status: session.status,
  payment_status: session.payment_status,
  mode: session.mode,
  metadata: session.metadata,
  client_reference_id: session.client_reference_id,
  customer: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
  customer_email: session.customer_details?.email ?? session.customer_email ?? null,
  subscription: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
  price: session.line_items?.data?.[0]?.price?.id ?? null,
});

const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
if (subId) {
  const sub = await stripe.subscriptions.retrieve(subId);
  console.log("=== stripe subscription ===");
  console.log({
    id: sub.id,
    status: sub.status,
    current_period_end: sub.current_period_end,
    item_period_end: sub.items?.data?.[0]?.current_period_end,
    metadata: sub.metadata,
  });
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const userId = session.metadata?.supabase_user_id || session.client_reference_id;
if (userId) {
  const { data, error } = await admin.from("subscriptions").select("*").eq("user_id", userId);
  console.log("=== supabase subscriptions row (user", userId, ") ===");
  console.log(error ?? data);
} else {
  console.log("!!! no supabase_user_id / client_reference_id on session — checkout was created unauthenticated");
}

const email = session.customer_details?.email ?? session.customer_email;
if (email) {
  const { data } = await admin.from("pending_subscriptions").select("*").eq("email", email.toLowerCase());
  console.log("=== pending_subscriptions for", email, "===");
  console.log(data);
}
