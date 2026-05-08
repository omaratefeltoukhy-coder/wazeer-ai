
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_price_id text,
  ADD COLUMN IF NOT EXISTS paddle_product_id text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_id ON public.subscriptions(paddle_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_env ON public.subscriptions(workspace_id, environment);
