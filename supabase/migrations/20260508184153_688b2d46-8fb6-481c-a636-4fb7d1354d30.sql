-- Product type & status enums
DO $$ BEGIN
  CREATE TYPE public.product_type AS ENUM (
    'physical_product','digital_file','online_course','live_event',
    'coaching','challenge','lead_form','membership'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('draft','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Products table (workspace-scoped)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  type public.product_type NOT NULL,
  title text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.product_status NOT NULL DEFAULT 'draft',
  cover_image_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sales_count integer NOT NULL DEFAULT 0,
  revenue_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_workspace_idx ON public.products(workspace_id);
CREATE INDEX IF NOT EXISTS products_workspace_status_idx ON public.products(workspace_id, status);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view products" ON public.products;
DROP POLICY IF EXISTS "members create products" ON public.products;
DROP POLICY IF EXISTS "members update products" ON public.products;
DROP POLICY IF EXISTS "owners delete products" ON public.products;

CREATE POLICY "members view products" ON public.products
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "members create products" ON public.products
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "members update products" ON public.products
  FOR UPDATE USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "owners delete products" ON public.products
  FOR DELETE USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('product-covers', 'product-covers', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('product-files', 'product-files', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for product covers (public-readable, owner-managed by uid prefix)
DROP POLICY IF EXISTS "Public can view product covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload product covers" ON storage.objects;
DROP POLICY IF EXISTS "Owners update product covers" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete product covers" ON storage.objects;

CREATE POLICY "Public can view product covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-covers');

CREATE POLICY "Authenticated upload product covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners update product covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete product covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for digital product files (private, owner-only)
DROP POLICY IF EXISTS "Owners view product files" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload product files" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete product files" ON storage.objects;

CREATE POLICY "Owners view product files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners upload product files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete product files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);
