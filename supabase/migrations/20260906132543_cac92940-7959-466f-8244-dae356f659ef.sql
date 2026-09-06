INSERT INTO public.msk_extension_models (provider_id, model_id, label, focus, is_free, visible, note, sort_order) VALUES
  ('groq', 'openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)', 'code', true, true, 'Recomendado para Código — modelo padrão.', 1),
  ('groq', 'qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)', 'code', true, true, 'Frontend / UI / CSS.', 2),
  ('groq', 'qwen/qwen3.6-27b', 'Qwen 3.6 27B (Groq)', 'code', true, true, 'Código / Revisão.', 3),
  ('groq', 'openai/gpt-oss-20b', 'GPT-OSS 20B (Groq)', 'code', true, true, 'Rápido.', 4),
  ('groq', 'groq/compound', 'Groq Compound', 'code', true, true, 'Agente.', 5),
  ('groq', 'groq/compound-mini', 'Groq Compound Mini', 'code', true, true, 'Agente Rápido.', 6),
  ('groq', 'openai/gpt-oss-safeguard-20b', 'GPT-OSS Safeguard 20B (Groq)', 'security', true, false, 'Segurança/moderação — não use como gerador de código.', 200),
  ('groq', 'meta-llama/llama-prompt-guard-2-22m', 'Llama Prompt Guard 2 22M (Groq)', 'security', true, false, 'Segurança/moderação — não use como gerador de código.', 201),
  ('groq', 'meta-llama/llama-prompt-guard-2-86m', 'Llama Prompt Guard 2 86M (Groq)', 'security', true, false, 'Segurança/moderação — não use como gerador de código.', 202),
  ('groq', 'whisper-large-v3', 'Whisper Large v3 (Groq)', 'audio', true, false, 'Somente áudio/transcrição.', 210),
  ('groq', 'whisper-large-v3-turbo', 'Whisper Large v3 Turbo (Groq)', 'audio', true, false, 'Somente áudio/transcrição.', 211),
  ('groq', 'canopylabs/orpheus-v1-english', 'Orpheus v1 English (Groq)', 'voice', true, false, 'Somente voz.', 220),
  ('groq', 'canopylabs/orpheus-arabic-saudi', 'Orpheus Arabic Saudi (Groq)', 'voice', true, false, 'Somente voz.', 221)
ON CONFLICT (provider_id, model_id) DO UPDATE
  SET label = EXCLUDED.label,
      focus = EXCLUDED.focus,
      is_free = EXCLUDED.is_free,
      visible = EXCLUDED.visible,
      note = EXCLUDED.note,
      sort_order = EXCLUDED.sort_order;