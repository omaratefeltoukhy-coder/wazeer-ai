
-- ENUMS
create type public.app_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.business_type as enum ('physical_product','digital_product','service','course','coaching','membership','event','subscription','other');
create type public.offer_status as enum ('draft','active','archived');
create type public.storefront_status as enum ('draft','published','unpublished');
create type public.media_type as enum ('image','video');
create type public.media_source as enum ('uploaded','ai_generated');
create type public.video_status as enum ('draft','rendering','ready','failed','posted');
create type public.email_status as enum ('draft','scheduled','sent','failed');
create type public.automation_status as enum ('active','paused','draft');
create type public.meta_platform as enum ('facebook','instagram');
create type public.post_status as enum ('draft','approved','scheduled','posted','failed');
create type public.campaign_status as enum ('draft','active','paused','completed','failed');
create type public.recommendation_priority as enum ('low','medium','high');
create type public.recommendation_status as enum ('open','dismissed','done');
create type public.subscription_plan as enum ('trial','starter','growth','pro','agency');
create type public.subscription_status as enum ('trialing','active','past_due','canceled','unpaid');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- WORKSPACES first (no dependency on businesses)
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
create trigger trg_ws_updated before update on public.workspaces for each row execute function public.set_updated_at();

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'editor',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table public.workspace_members enable row level security;

create or replace function public.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = _workspace_id and user_id = _user_id);
$$;

create or replace function public.has_workspace_role(_workspace_id uuid, _user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = _workspace_id and user_id = _user_id and role = any(_roles));
$$;

create policy "members view workspaces" on public.workspaces for select using (public.is_workspace_member(id, auth.uid()));
create policy "owners update workspaces" on public.workspaces for update using (public.has_workspace_role(id, auth.uid(), array['owner','admin']::public.app_role[]));
create policy "users create workspaces" on public.workspaces for insert with check (auth.uid() = owner_user_id);
create policy "owners delete workspaces" on public.workspaces for delete using (public.has_workspace_role(id, auth.uid(), array['owner']::public.app_role[]));

create policy "members view their memberships" on public.workspace_members for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id, auth.uid()));
create policy "owners insert members" on public.workspace_members for insert with check (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]) or auth.uid() = user_id);
create policy "owners update members" on public.workspace_members for update using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]));
create policy "owners delete members" on public.workspace_members for delete using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]));

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_ws_id uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (owner_user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'My') || '''s Workspace')
  returning id into new_ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, new.id, 'owner');

  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- BUSINESSES
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  name text not null,
  type public.business_type not null default 'other',
  description text,
  category text,
  target_audience text,
  pain_point text,
  desired_result text,
  country text,
  currency text default 'USD',
  language text default 'en',
  goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.businesses enable row level security;
create trigger trg_biz_updated before update on public.businesses for each row execute function public.set_updated_at();
create policy "members view businesses" on public.businesses for select using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "members create businesses" on public.businesses for insert with check (public.is_workspace_member(workspace_id, auth.uid()));
create policy "members update businesses" on public.businesses for update using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "owners delete businesses" on public.businesses for delete using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]));

create or replace function public.can_access_business(_business_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.businesses b
    where b.id = _business_id and public.is_workspace_member(b.workspace_id, _user_id)
  );
$$;

-- BUSINESS INPUTS
create table public.business_inputs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  input_type text not null check (input_type in ('text','image','video','url')),
  original_text text,
  uploaded_file_url text,
  extracted_data_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.business_inputs enable row level security;
create policy "members manage inputs" on public.business_inputs for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

-- BRAND PROFILES
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  brand_name text,
  tone text,
  visual_style text,
  positioning text,
  colors_json jsonb default '{}'::jsonb,
  audience_json jsonb default '{}'::jsonb,
  pain_points_json jsonb default '[]'::jsonb,
  benefits_json jsonb default '[]'::jsonb,
  objections_json jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.brand_profiles enable row level security;
create trigger trg_brand_updated before update on public.brand_profiles for each row execute function public.set_updated_at();
create policy "members manage brand profiles" on public.brand_profiles for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

-- OFFERS
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type public.business_type not null default 'other',
  description text,
  price numeric(12,2) default 0,
  currency text default 'USD',
  billing_interval text,
  free_trial_days int default 0,
  discount_json jsonb default '{}'::jsonb,
  status public.offer_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.offers enable row level security;
create trigger trg_offers_updated before update on public.offers for each row execute function public.set_updated_at();
create policy "members manage offers" on public.offers for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));
create policy "public view active offers" on public.offers for select using (status = 'active');

-- STOREFRONTS
create table public.storefronts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text unique not null,
  title text,
  content_json jsonb default '{}'::jsonb,
  published_url text,
  status public.storefront_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.storefronts enable row level security;
create trigger trg_storefronts_updated before update on public.storefronts for each row execute function public.set_updated_at();
create policy "members manage storefronts" on public.storefronts for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));
create policy "public view published storefronts" on public.storefronts for select using (status = 'published');

-- MEDIA
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type public.media_type not null,
  source public.media_source not null,
  file_url text,
  prompt text,
  metadata_json jsonb default '{}'::jsonb,
  status text default 'ready',
  created_at timestamptz not null default now()
);
alter table public.media_assets enable row level security;
create policy "members manage media" on public.media_assets for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

-- UGC
create table public.ugc_scripts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text,
  script_json jsonb default '{}'::jsonb,
  platform text,
  performance_score int,
  status text default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ugc_scripts enable row level security;
create trigger trg_scripts_updated before update on public.ugc_scripts for each row execute function public.set_updated_at();
create policy "members manage ugc scripts" on public.ugc_scripts for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

create table public.ugc_videos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  script_id uuid references public.ugc_scripts(id) on delete set null,
  video_url text,
  storyboard_json jsonb default '{}'::jsonb,
  provider_job_id text,
  status public.video_status not null default 'draft',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ugc_videos enable row level security;
create trigger trg_videos_updated before update on public.ugc_videos for each row execute function public.set_updated_at();
create policy "members manage ugc videos" on public.ugc_videos for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

-- EMAIL
create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text,
  content_json jsonb default '{}'::jsonb,
  status public.email_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_campaigns enable row level security;
create trigger trg_campaigns_updated before update on public.email_campaigns for each row execute function public.set_updated_at();
create policy "members manage email campaigns" on public.email_campaigns for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

create table public.email_automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  trigger_type text,
  steps_json jsonb default '[]'::jsonb,
  status public.automation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_automations enable row level security;
create trigger trg_automations_updated before update on public.email_automations for each row execute function public.set_updated_at();
create policy "members manage email automations" on public.email_automations for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text,
  name text,
  phone text,
  tags_json jsonb default '[]'::jsonb,
  source text,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contacts enable row level security;
create trigger trg_contacts_updated before update on public.contacts for each row execute function public.set_updated_at();
create policy "members manage contacts" on public.contacts for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid references public.email_campaigns(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  event_type text not null,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.email_events enable row level security;
create policy "members view email events" on public.email_events for select using (public.can_access_business(business_id, auth.uid()));
create policy "members insert email events" on public.email_events for insert with check (public.can_access_business(business_id, auth.uid()));

-- META
create table public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  provider text not null default 'meta',
  page_id text,
  instagram_account_id text,
  ad_account_id text,
  token_status text default 'not_connected',
  permissions_json jsonb default '[]'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.meta_connections enable row level security;
create trigger trg_meta_conn_updated before update on public.meta_connections for each row execute function public.set_updated_at();
create policy "members manage meta connections" on public.meta_connections for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

create table public.meta_posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  platform public.meta_platform not null,
  caption text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  status public.post_status not null default 'draft',
  insights_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.meta_posts enable row level security;
create trigger trg_meta_posts_updated before update on public.meta_posts for each row execute function public.set_updated_at();
create policy "members manage meta posts" on public.meta_posts for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

create table public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  external_campaign_id text,
  name text not null,
  objective text,
  budget numeric(12,2),
  status public.campaign_status not null default 'draft',
  start_date date,
  end_date date,
  insights_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.meta_campaigns enable row level security;
create trigger trg_meta_camp_updated before update on public.meta_campaigns for each row execute function public.set_updated_at();
create policy "members manage meta campaigns" on public.meta_campaigns for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

create table public.meta_ads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  campaign_id uuid references public.meta_campaigns(id) on delete cascade,
  external_ad_id text,
  creative_id text,
  headline text,
  primary_text text,
  cta text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  status public.campaign_status not null default 'draft',
  insights_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.meta_ads enable row level security;
create trigger trg_meta_ads_updated before update on public.meta_ads for each row execute function public.set_updated_at();
create policy "members manage meta ads" on public.meta_ads for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

-- ANALYTICS + RECOMMENDATIONS
create table public.performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  metrics_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.performance_snapshots enable row level security;
create policy "members view snapshots" on public.performance_snapshots for select using (public.can_access_business(business_id, auth.uid()));
create policy "members insert snapshots" on public.performance_snapshots for insert with check (public.can_access_business(business_id, auth.uid()));

create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null,
  priority public.recommendation_priority not null default 'medium',
  title text not null,
  problem text,
  recommendation text,
  action_json jsonb default '{}'::jsonb,
  confidence_score numeric(3,2) default 0.7,
  status public.recommendation_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_recommendations enable row level security;
create trigger trg_recs_updated before update on public.ai_recommendations for each row execute function public.set_updated_at();
create policy "members manage recommendations" on public.ai_recommendations for all using (public.can_access_business(business_id, auth.uid())) with check (public.can_access_business(business_id, auth.uid()));

-- BILLING
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan public.subscription_plan not null default 'trial',
  status public.subscription_status not null default 'trialing',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create trigger trg_subs_updated before update on public.subscriptions for each row execute function public.set_updated_at();
create policy "members view workspace subscription" on public.subscriptions for select using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "owners manage subscription" on public.subscriptions for all using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[])) with check (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]));

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  amount int not null,
  reason text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.credit_transactions enable row level security;
create policy "members view credits" on public.credit_transactions for select using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "members insert credits" on public.credit_transactions for insert with check (public.is_workspace_member(workspace_id, auth.uid()));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.contacts(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  amount numeric(12,2) not null,
  currency text default 'USD',
  payment_status text default 'pending',
  source text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "members view orders" on public.orders for select using (public.can_access_business(business_id, auth.uid()));
create policy "members insert orders" on public.orders for insert with check (public.can_access_business(business_id, auth.uid()));
create policy "members update orders" on public.orders for update using (public.can_access_business(business_id, auth.uid()));

-- INDEXES
create index idx_businesses_workspace on public.businesses(workspace_id);
create index idx_offers_business on public.offers(business_id);
create index idx_storefronts_business on public.storefronts(business_id);
create index idx_media_business on public.media_assets(business_id);
create index idx_scripts_business on public.ugc_scripts(business_id);
create index idx_videos_business on public.ugc_videos(business_id);
create index idx_campaigns_business on public.email_campaigns(business_id);
create index idx_meta_posts_business on public.meta_posts(business_id);
create index idx_recs_business on public.ai_recommendations(business_id);
create index idx_orders_business on public.orders(business_id);
create index idx_workspace_members_user on public.workspace_members(user_id);
