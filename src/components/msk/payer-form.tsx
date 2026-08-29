import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBillingProfile, saveBillingProfile } from "@/lib/account.functions";
import { isValidDocument, isValidPhoneBR, maskDocument, maskPhone, onlyDigits } from "@/lib/br";
import { supabase } from "@/integrations/supabase/client";

export type Billing = { name: string; email: string; document: string; phone: string };

export function useBilling() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["billing-profile"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return null;
      try {
        return await getBillingProfile();
      } catch {
        // Sessão ausente/expirada: evita quebrar a tela com erro 401.
        return null;
      }
    },
    staleTime: 60_000,
    enabled: authed === true,
    retry: false,
  });
  const complete = !!data && isValidDocument(data.document) && isValidPhoneBR(data.phone);
  return { billing: data as Billing | undefined, isLoading: authed === null || isLoading, complete };
}

/** Formulário de dados do pagador com máscara, validação real e autofill do navegador. */
export function PayerForm({
  onSaved,
  compact,
}: {
  onSaved?: (b: { document: string; phone: string }) => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const { billing, complete } = useBilling();
  const [editing, setEditing] = useState(false);
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!billing) return;
    setDocument(maskDocument(billing.document ?? ""));
    setPhone(maskPhone(billing.phone ?? ""));
  }, [billing?.document, billing?.phone]);

  const save = useMutation({
    mutationFn: () =>
      saveBillingProfile({ data: { document: onlyDigits(document), phone: onlyDigits(phone) } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["billing-profile"] });
      setEditing(false);
      toast.success("Dados salvos na sua conta.");
      onSaved?.({ document: res.document, phone: res.phone });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const docOk = isValidDocument(document);
  const phoneOk = isValidPhoneBR(phone);

  if (complete && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Dados do pagador
          </p>
          <p className="mt-1 truncate text-sm">
            {maskDocument(billing!.document)} · {maskPhone(billing!.phone)}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
        </Button>
      </div>
    );
  }

  return (
    <form
      className={compact ? "space-y-3" : "space-y-4"}
      onSubmit={(e) => {
        e.preventDefault();
        if (!docOk || !phoneOk) return;
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payer-document">CPF ou CNPJ</Label>
          <Input
            id="payer-document"
            name="document"
            autoComplete="on"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={document}
            onChange={(e) => setDocument(maskDocument(e.target.value))}
            aria-invalid={!!document && !docOk}
          />
          {!!document && !docOk && (
            <p className="text-[0.7rem] text-destructive">CPF/CNPJ inválido.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payer-phone">Telefone com DDD</Label>
          <Input
            id="payer-phone"
            name="tel"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="(11) 90000-0000"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            aria-invalid={!!phone && !phoneOk}
          />
          {!!phone && !phoneOk && (
            <p className="text-[0.7rem] text-destructive">Telefone inválido.</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          variant="neon"
          className="h-12 w-full whitespace-normal break-words px-4 text-center text-xs font-black uppercase leading-tight tracking-widest sm:flex-1"
          disabled={!docOk || !phoneOk || save.isPending}
        >
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />}
          Continuar para pagamento
        </Button>
        {complete && (
          <Button
            type="button"
            variant="ghost"
            className="h-12 w-full text-xs sm:w-auto"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
