-- Create app_settings table for dynamic site configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Grant access to app_settings
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policies for app_settings
CREATE POLICY "Public can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Create cms_drafts table for draft system
CREATE TABLE IF NOT EXISTS public.cms_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL,
    data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    published_at timestamptz
);

-- Grant access to cms_drafts
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_drafts TO authenticated;
GRANT ALL ON public.cms_drafts TO service_role;

-- Enable RLS
ALTER TABLE public.cms_drafts ENABLE ROW LEVEL SECURITY;

-- Policies for cms_drafts (Admin only)
CREATE POLICY "Admins can manage drafts" ON public.cms_drafts 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Create change_history table
CREATE TABLE IF NOT EXISTS public.cms_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    created_at timestamptz DEFAULT now()
);

-- Grant access to cms_history
GRANT SELECT ON public.cms_history TO authenticated;
GRANT ALL ON public.cms_history TO service_role;

-- Enable RLS
ALTER TABLE public.cms_history ENABLE ROW LEVEL SECURITY;

-- Policies for cms_history (Admin only)
CREATE POLICY "Admins can view history" ON public.cms_history 
FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Initial Settings Seed
INSERT INTO public.app_settings (key, value) VALUES
('hero', '{"title": "Pare de ser interrompido no meio da criação", "subtitle": "Acesso completo à extensão Lovable com créditos infinitos.", "cta_text": "Quero créditos infinitos agora", "cta_link": "/auth"}'),
('partners_teaser', '{"title": "Revenda e ganhe comissões recorrentes", "subtitle": "Entre para o programa de parceiros Infinity...", "cta_text": "Quero participar"}')
ON CONFLICT (key) DO NOTHING;
