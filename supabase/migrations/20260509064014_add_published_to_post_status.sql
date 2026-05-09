-- Add 'published' to post_status enum so meta_posts can use it consistently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'published'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'post_status')
  ) THEN
    ALTER TYPE public.post_status ADD VALUE 'published';
  END IF;
END $$;
