create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid,
  amount_usd numeric(10,2) not null,
  currency text not null default 'USD',
  status text not null default 'paid',
  description text,
  kind text not null default 'subscription',
  external_invoice_id text,
  pdf_url text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
create policy "members view invoices" on public.invoices for select
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "members insert invoices" on public.invoices for insert
  with check (public.is_workspace_member(workspace_id, auth.uid()));
create index if not exists idx_invoices_ws_created on public.invoices(workspace_id, created_at desc);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  provider text not null default 'mock',
  event_type text not null,
  external_event_id text,
  payload_json jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
create policy "members view billing events" on public.billing_events for select
  using (workspace_id is null or public.is_workspace_member(workspace_id, auth.uid()));