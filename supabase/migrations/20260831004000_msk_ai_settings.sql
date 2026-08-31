-- MSK Agente: credencial global da IA, gravada somente em formato cifrado.
create table if not exists public.msk_ai_settings (
  id text primary key default 'default',
  provider text not null default 'B.AI',
  model text not null default 'deepseek-v4-flash',
  api_base_url text not null default 'https://api.b.ai/v1/chat/completions',
  api_key_ciphertext text,
  api_key_last4 text,
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.msk_ai_settings enable row level security;
revoke all on table public.msk_ai_settings from anon, authenticated;
comment on table public.msk_ai_settings is 'Configuração global da IA do MSK. A API key nunca é armazenada em texto puro.';
