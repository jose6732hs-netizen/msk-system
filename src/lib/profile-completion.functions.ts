import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCPF, isValidPhoneBR, onlyDigits } from "./br";

function claimIdentity(claims: unknown) {
  const current = (claims ?? {}) as Record<string, any>;
  const metadata = (current["user_metadata"] ?? {}) as Record<string, any>;
  const email = typeof current["email"] === "string" ? current["email"] : null;
  const candidate = metadata["name"] ?? metadata["full_name"] ?? metadata["user_name"];
  const name = typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  return { email, name };
}

async function ensureProfile(userId: string, claims: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,name,email,phone,document")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar perfil: ${error.message}`);
  if (data) return data as Record<string, any>;

  // Login social (Google/Apple) pode autenticar antes de existir uma linha em profiles.
  // Criamos somente o perfil mínimo; telefone continua obrigatório logo abaixo.
  const identity = claimIdentity(claims);
  const { data: created, error: createError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: identity.email,
        name: identity.name,
      } as any,
      { onConflict: "id" },
    )
    .select("id,name,email,phone,document")
    .single();

  if (createError) throw new Error(`Erro ao criar perfil: ${createError.message}`);
  return created as Record<string, any>;
}

export const getProfileCompletion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await ensureProfile(context.userId, context.claims);
    const phone = onlyDigits(String(profile["phone"] ?? ""));
    const document = onlyDigits(String(profile["document"] ?? ""));

    return {
      phone,
      hasPhone: isValidPhoneBR(phone),
      hasDocument: isValidCPF(document),
    };
  });

export const saveRequiredPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ phone: z.string().min(10).max(20) })
      .transform((value) => ({ phone: onlyDigits(value.phone) }))
      .refine((value) => isValidPhoneBR(value.phone), {
        message: "Informe um telefone válido com DDD.",
        path: ["phone"],
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await ensureProfile(context.userId, context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ phone: data.phone })
      .eq("id", context.userId);

    if (error) throw new Error(`Erro ao salvar telefone: ${error.message}`);
    return { ok: true, phone: data.phone };
  });
