#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"
APP_URL="${APP_URL:-http://localhost:3000}"
WEBHOOK_PATH="${WEBHOOK_PATH:-/api/webhook}"

required_env=(
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "NEXT_PUBLIC_SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_STRIPE_PRICE_DISCOVERY_MONTHLY"
  "NEXT_PUBLIC_STRIPE_PRICE_ESSENTIAL_MONTHLY"
)

echo "== Stripe/Supabase E2E preflight =="

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE"
  exit 1
fi

missing=0
for key in "${required_env[@]}"; do
  if ! rg -n "^${key}=.+" "$ENV_FILE" >/dev/null 2>&1; then
    echo "❌ Missing env: $key"
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  echo ""
  echo "Add missing vars to .env.local, then run again."
  exit 1
fi

if ! command -v stripe >/dev/null 2>&1; then
  echo "❌ Stripe CLI is not installed."
  echo "Install: npm i -g @stripe/stripe-cli"
  exit 1
fi

if ! curl -fsS "$APP_URL/api/health" >/dev/null 2>&1; then
  echo "❌ App is not reachable at $APP_URL"
  echo "Start it in another terminal: npm run dev"
  exit 1
fi

echo "✅ Env variables found"
echo "✅ Stripe CLI available"
echo "✅ App reachable at $APP_URL"
echo ""
echo "== Step 1: Start webhook forwarding =="
echo "stripe listen --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded --forward-to $APP_URL$WEBHOOK_PATH"
echo ""
echo "⚠️  If Stripe CLI prints a new whsec_..., set it in .env.local as STRIPE_WEBHOOK_SECRET and restart Next.js."
echo ""
echo "== Step 2: Create a test checkout from your app UI =="
echo "Open: $APP_URL/pricing"
echo "Use card: 4242 4242 4242 4242 (any future date, any CVC, any ZIP)"
echo ""
echo "== Step 3: Validate webhook deliveries in CLI output =="
echo "- checkout.session.completed -> should return 200"
echo "- customer.subscription.updated -> should return 200"
echo "- customer.subscription.deleted -> should return 200 after cancellation"
echo ""
echo "== Step 4: Verify Supabase rows =="
echo "Run in Supabase SQL editor:"
cat <<'SQL'
-- Replace with the authenticated user UUID
select user_id, plan, status, billing_cycle, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at
from public.subscriptions
where user_id = 'YOUR_USER_UUID';

-- Optional: inspect pending checkouts by email
select email, plan, status, billing_cycle, stripe_customer_id, stripe_subscription_id, updated_at
from public.pending_subscriptions
order by updated_at desc
limit 20;
SQL
echo ""
echo "== Step 5: Cancellation path =="
echo "Cancel from your Settings page (or Stripe Dashboard), then confirm:"
echo "- customer.subscription.deleted delivered (200)"
echo "- subscriptions.status becomes 'canceled' and stripe_subscription_id is null"
echo ""
echo "Done."
