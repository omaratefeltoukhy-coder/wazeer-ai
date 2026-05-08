
-- ad_campaigns
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  business_id uuid,
  product_id uuid,
  name text NOT NULL,
  objective text,
  audience_type text DEFAULT 'new_customers',
  status text NOT NULL DEFAULT 'draft',
  budget_daily numeric NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ad_variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  spent_amount numeric NOT NULL DEFAULT 0,
  result_count integer NOT NULL DEFAULT 0,
  meta_campaign_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view ad_campaigns" ON public.ad_campaigns FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members insert ad_campaigns" ON public.ad_campaigns FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "members update ad_campaigns" ON public.ad_campaigns FOR UPDATE USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "owners delete ad_campaigns" ON public.ad_campaigns FOR DELETE USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_ad_campaigns_updated BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ad_analytics
CREATE TABLE IF NOT EXISTS public.ad_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  date date NOT NULL,
  ad_views integer NOT NULL DEFAULT 0,
  page_visits integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view ad_analytics" ON public.ad_analytics FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members insert ad_analytics" ON public.ad_analytics FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX idx_ad_analytics_campaign_date ON public.ad_analytics(campaign_id, date);

-- pixel_integrations
CREATE TABLE IF NOT EXISTS public.pixel_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  provider text NOT NULL,
  pixel_id text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider)
);
ALTER TABLE public.pixel_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view pixels" ON public.pixel_integrations FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members manage pixels" ON public.pixel_integrations FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_pixel_integrations_updated BEFORE UPDATE ON public.pixel_integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
