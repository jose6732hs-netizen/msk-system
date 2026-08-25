import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProfileCompletion, saveRequiredPhone } from "@/lib/profile-completion.functions";
import { isValidPhoneBR, maskPhone, onlyDigits } from "@/lib/br";

export function RequiredPhoneGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const checkProfile = useServerFn(getProfileCompletion);
  const savePhone = useServerFn(saveRequiredPhone);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["profile-completion"],
    queryFn: () => checkProfile(),
    retry: 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data?.phone && !phone) setPhone(maskPhone(data.phone));
  }, [data?.phone, phone]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Verificando seu cadastro
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-5">
        <div className="glass w-full max-w-md rounded-3xl border border-destructive/20 p-6 text-center">
          <p className="text-sm font-black uppercase tracking-widest">Não foi possível verificar seu cadastro</p>
          <p className="mt-2 text-xs text-muted-foreground">{(error as Error).message}</p>
          <Button className="mt-5" variant="neonOutline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (data?.hasPhone) return <>{children}</>;

  async function submit() {
    const digits = onlyDigits(phone);
    if (!isValidPhoneBR(digits)) {
      toast.error("Informe um telefone válido com DDD.");
      return;
    }

    setSaving(true);
    try {
      const result = await savePhone({ data: { phone: digits } });
      qc.setQueryData(["profile-completion"], {
        ...(data ?? {}),
        phone: result.phone,
        hasPhone: true,
      });
      await qc.invalidateQueries({ queryKey: ["account"] });
      toast.success("Telefone confirmado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.13),transparent_45%)]" />
      <div className="glass relative w-full max-w-md rounded-[2rem] border border-primary/20 p-6 shadow-2xl md:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Phone className="h-6 w-6" />
        </div>
        <div className="mt-5 text-center">
          <h1 className="text-xl font-black uppercase tracking-wider">Confirme seu telefone</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Para continuar na plataforma, informe um número com DDD. Essa confirmação também é obrigatória para contas criadas com Google, Apple ou outro login social.
          </p>
        </div>

        <div className="mt-6 space-y-2">
          <Label htmlFor="required-phone">Telefone / WhatsApp</Label>
          <Input
            id="required-phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !saving) void submit();
            }}
            className="h-12 rounded-xl"
            autoFocus
          />
        </div>

        <Button onClick={submit} disabled={saving} variant="neon" className="mt-5 h-12 w-full rounded-xl">
          {saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Confirmar e continuar
        </Button>
        <p className="mt-4 text-center text-[0.65rem] leading-relaxed text-muted-foreground">
          O número fica vinculado ao seu perfil e é reutilizado nas validações da sua conta.
        </p>
      </div>
    </div>
  );
}
