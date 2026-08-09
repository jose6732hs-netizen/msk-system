
TRUNCATE public.plans CASCADE;

INSERT INTO public.plans (id, name, slug, description, price, currency, duration_label, max_devices, highlights, active, sort_order)
VALUES 
(
  gen_random_uuid(),
  'LICENÇA FREE — TESTE',
  'free-test',
  'Ideal para conhecer a ferramenta antes de comprar',
  0,
  'BRL',
  '15 minutos',
  1,
  ARRAY[
    'Acesso completo durante o período de teste',
    'Teste das principais funções da extensão',
    'Sem compromisso',
    'Ativação rápida',
    '1 teste por usuário/IP'
  ],
  true,
  1
),
(
  gen_random_uuid(),
  'LICENÇA DIÁRIA',
  'daily',
  'Ideal para uso pontual',
  5.90,
  'BRL',
  '1 dia',
  1,
  ARRAY[
    'Acesso completo por 24 horas',
    'Todas as funções disponíveis no plano',
    'Ativação imediata',
    'Sem compromisso de longo prazo'
  ],
  true,
  2
),
(
  gen_random_uuid(),
  'LICENÇA SEMANAL',
  'weekly',
  'Excelente para uso temporário',
  29.90,
  'BRL',
  '7 dias',
  1,
  ARRAY[
    '7 dias de acesso',
    'Todas as funções disponíveis',
    'Mais tempo para testar e utilizar',
    'Renovação quando necessário'
  ],
  true,
  3
),
(
  gen_random_uuid(),
  'LICENÇA MENSAL',
  'monthly',
  'Melhor custo-benefício para uso recorrente',
  79.90,
  'BRL',
  '30 dias',
  2,
  ARRAY[
    '30 dias de acesso',
    'Todas as funções disponíveis',
    'Até 2 dispositivos',
    'Ideal para usuários frequentes'
  ],
  true,
  4
),
(
  gen_random_uuid(),
  'LICENÇA TRIMESTRAL',
  'quarterly',
  'Ideal para uso profissional',
  199.90,
  'BRL',
  '90 dias',
  4,
  ARRAY[
    '90 dias de acesso',
    'Todas as funções disponíveis',
    'Até 4 dispositivos',
    'Maior economia',
    'Menos necessidade de renovação'
  ],
  true,
  5
);
