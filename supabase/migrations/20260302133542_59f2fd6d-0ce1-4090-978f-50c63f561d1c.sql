
-- Table to store applicants submitted via Tally webhook
CREATE TABLE public.webhook_applicants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_slug TEXT NOT NULL DEFAULT 'loubani-grants-2026',
  submission_id TEXT UNIQUE,
  applicant_name TEXT NOT NULL DEFAULT 'Unnamed',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow edge functions to insert (anon role for webhook)
ALTER TABLE public.webhook_applicants ENABLE ROW LEVEL SECURITY;

-- Webhook can insert
CREATE POLICY "Allow anonymous insert for webhook"
  ON public.webhook_applicants
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anyone to read (admin will fetch these)
CREATE POLICY "Allow anonymous read"
  ON public.webhook_applicants
  FOR SELECT
  TO anon
  USING (true);

-- Allow update (to mark as imported)
CREATE POLICY "Allow anonymous update"
  ON public.webhook_applicants
  FOR UPDATE
  TO anon
  USING (true);
