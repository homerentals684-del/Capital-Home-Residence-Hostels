ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS provider_reference text;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';