CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  status text NOT NULL DEFAULT 'pending',
  provider_id text,
  cost_cents integer,
  error text,
  sent_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sms_messages TO authenticated;
GRANT ALL ON public.sms_messages TO service_role;

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sms messages"
  ON public.sms_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sms messages"
  ON public.sms_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sms messages"
  ON public.sms_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX sms_messages_phone_created_idx ON public.sms_messages (phone, created_at DESC);
CREATE INDEX sms_messages_recipient_idx ON public.sms_messages (recipient_user_id);