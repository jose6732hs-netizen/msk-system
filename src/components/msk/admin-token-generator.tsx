import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, MessageSquare, ShieldCheck, ClipboardCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminGenerateToken, adminTokenPlans, adminGetLicenseDetails } from "@/lib/admin.functions";
import { generateDeliveryMessage, generateSalesMessage, copyToClipboard } from "@/lib/delivery-message";

const DURATIONS = [
  { id: "trial15", label: "Trial — 15 minutos" },
  { id: "trial60", label: "Trial — 1 hora" },
  { id: "day1", label: "1 dia" },
  { id: "day7", label: "7 dias" },
  { id: "day30", label: "30 dias" },
  { id: "day90", label: "90 dias" },
  { id: "day365", label: "1 ano" },
  { id: "lifetime", label: "Vitalício" },
  { id: "custom", label: "Personalizado" },
] as const;

type Duration = (typeof DURATIONS)[number]["id"];

export function AdminTokenGenerator({ initialIssued, onReset }: { initialIssued?: { token: string; email: string; licenseId: string } | null, onReset?: () => void }) {
  const plansFn = useServerFn(adminTokenPlans);
  const generateFn = useServerFn(adminGenerateToken);

  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-token-plans"], queryFn: () => plansFn() });
  const plans = data?.plans ?? [];

  const [email, setEmail] = useState("");
  const [standalone, setStandalone] = useState(false);
  const [planId, setPlanId] = useState("");
  const [duration, setDuration] = useState<Duration>("day30");
  const [customDays, setCustomDays] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [maxDevices, setMaxDevices] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [issued, setIssued] = useState<{ token: string; email: string; licenseId: string } | null>(initialIssued || null);

  useMemo(() => {
    const firstPlanId = plans?.[0]?.["id"] as string | undefined;
    if (firstPlanId && !planId) {
      setPlanId(firstPlanId);
    }
  }, [plans, planId]);

  useMemo(() => {
    if (initialIssued) {
      setIssued(initialIssued);
    }
  }, [initialIssued]);

  const resetIssued = () => {
    setIssued(null);
    if (onReset) onReset();
  };
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const plan = planId || (plans.length > 0 ? (plans[0]?.["id"] as string) : "");
    
    if (!plan) {
      toast.error("Erro: Nenhum plano selecionado ou disponível.");
      return;
    }
    setLoading(true);
    try {
      const res = await generateFn({
        data: {
          ...(standalone ? { standalone: true } : { email: email.trim() }),
          planId: plan,
          duration,
          ...(duration === "custom" && customDays ? { customDays: Number(customDays) } : {}),
          ...(duration === "custom" && customMinutes ? { customMinutes: Number(customMinutes) } : {}),
          ...(maxDevices ? { maxDevices: Number(maxDevices) } : {}),
          ...(note ? { note } : {}),
        },
      });
      setIssued({
        token: res.token,
        email: res.user.email ?? (standalone ? "Licença de teste (sem usuário)" : email.trim()),
        licenseId: res.licenseId,
      });
      setCopied(false);
      toast.success("Token gerado com sucesso.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }


  async function copy() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.token);
    setCopied(true);
    toast.success("Token copiado.");
  }

  return (
    <div className="space-y-6">
      {issued && (
        <div className="mb-6">
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={resetIssued} className="text-xs">
              <X className="h-3 w-3 mr-1" /> Limpar entrega
            </Button>
          </div>
          <TokenDeliveryCard licenseId={issued.licenseId} fullToken={issued.token === "Carregando..." ? null : issued.token} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Gerar token manual</h2>
          <p className="text-xs text-muted-foreground">
            Exclusivo do Super Admin. Gere para um cliente ou emita uma licença de teste sem
            usuário vinculado.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={standalone}
            onChange={(e) => setStandalone(e.target.checked)}
          />
          <span>
            Licença de teste (sem usuário)
            <span className="block text-xs text-muted-foreground">
              Emite um token avulso, sem vincular a nenhuma conta — ideal para QA e homologação.
            </span>
          </span>
        </label>

        {!standalone && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tk-email">E-mail do usuário</Label>
            <Input
              id="tk-email"
              type="email"
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}


        <div className="space-y-1.5">
          <Label htmlFor="tk-plan">Plano</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger id="tk-plan" className="h-10 w-full">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Carregando planos...</span>
                </div>
              ) : (
                <SelectValue placeholder="Escolha o plano da licença" />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {plans && plans.length > 0 ? (
                plans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.price > 0 ? `R$ ${p.price.toFixed(2)}` : "Grátis"} • {p.duration_label || (p.is_lifetime ? "Vitalício" : `${p.duration_days} dias`)}
                      </span>
                    </div>
                  </SelectItem>
                ))
              ) : !isLoading ? (
                <div className="px-3 py-2 text-sm text-muted-foreground italic">
                  Nenhum plano disponível para emissão manual. Verifique se existem planos cadastrados.
                </div>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Buscando planos...
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tk-duration">Validade</Label>
          <Select value={duration} onValueChange={(v) => setDuration(v as Duration)}>
            <SelectTrigger id="tk-duration" className="h-10 w-full">
              <SelectValue placeholder="Escolha a validade" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {DURATIONS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {duration === "custom" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="tk-days">Dias</Label>
              <Input
                id="tk-days"
                type="number"
                min={1}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-min">Minutos</Label>
              <Input
                id="tk-min"
                type="number"
                min={1}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="tk-dev">Máx. dispositivos (opcional)</Label>
          <Input
            id="tk-dev"
            type="number"
            min={1}
            placeholder="Padrão do plano"
            value={maxDevices}
            onChange={(e) => setMaxDevices(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tk-note">Observação (opcional)</Label>
          <Input
            id="tk-note"
            placeholder="Motivo da emissão"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" variant="neon" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar token"}
          </Button>
        </div>
      </form>

      {issued && (
        <div className="glass rounded-2xl p-5 neon-glow">
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            Token gerado para {issued.email}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-background/60 px-3 py-2 font-mono text-sm text-primary">
              {issued.token}
            </code>
            <Button size="sm" variant="neonOutline" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Guarde agora: por segurança, o token completo não é exibido novamente.
          </p>
        </div>
      )}
    </div>
  );
}

function TokenDeliveryCard({ licenseId, fullToken: propToken }: { licenseId?: string; fullToken?: string | null }) {
  const getDetailsFn = useServerFn(adminGetLicenseDetails);
  const [copiedType, setCopiedType] = useState<"token" | "message" | "all" | "sales" | null>(null);

  const { data: license, isLoading } = useQuery({
    queryKey: ["admin-license-details", licenseId],
    queryFn: () => getDetailsFn({ data: { licenseId: licenseId! } }),
    enabled: !!licenseId,
  });

  const fullToken = propToken || license?.fullToken || "";

  const deliveryData = useMemo(() => {
    if (!license || !fullToken) return null;

    const plan = license.plans;
    const isTrial = license.type === "trial" || license.type === "test";
    
    let duration = "30 dias";
    if (plan?.is_lifetime) duration = "VITALÍCIA";
    else if (license.expires_at) {
      const diff = new Date(license.expires_at).getTime() - new Date(license.created_at).getTime();
      const mins = Math.round(diff / 60000);
      const days = Math.round(diff / 86400000);
      if (mins < 1440) duration = `${mins} minutos`;
      else duration = `${days} dias`;
    }

    const activationInfo = license.activated_at ? new Date(license.activated_at).toLocaleString("pt-BR") : "Primeira ativação";
    const expirationInfo = license.expires_at 
      ? new Date(license.expires_at).toLocaleString("pt-BR") 
      : (license.status === "active" && !plan?.is_lifetime ? "Será definida após a ativação" : "N/A");

    return {
      productName: "MSK Suite - Extensão Premium",
      planName: plan?.name || (isTrial ? "Teste Gratuito" : "Manual"),
      planDuration: duration,
      maxDevices: license.max_devices || 1,
      licenseKey: fullToken,
      activationInfo,
      expirationInfo: plan?.is_lifetime ? "VITALÍCIA" : expirationInfo,
      isTrial,
      licenseStatus: license.status === "active" ? "🟢 Ativa / Disponível" : `🔴 ${license.status.toUpperCase()}`,
    };
  }, [license, fullToken]);

  const message = useMemo(() => deliveryData ? generateDeliveryMessage(deliveryData) : "", [deliveryData]);
  const salesMessage = useMemo(() => deliveryData ? generateSalesMessage(deliveryData) : "", [deliveryData]);

  if (!licenseId || isLoading || !deliveryData) return null;

  const handleCopy = (type: "token" | "message" | "all" | "sales") => {
    let text = "";
    let toastMsg = "";

    if (type === "token") {
      text = fullToken || "";
      toastMsg = "✅ Licença copiada!";
    } else if (type === "message") {
      text = message;
      toastMsg = "✅ Mensagem completa copiada!";
    } else if (type === "sales") {
      text = salesMessage;
      toastMsg = "✅ Texto de vendas copiado!";
    } else {
      text = `PRODUTO: ${deliveryData.productName}\nPLANO: ${deliveryData.planName}\nLICENÇA: ${fullToken}\nVALIDADE: ${deliveryData.planDuration}\nDISPOSITIVOS: ${deliveryData.maxDevices}\nINSTRUÇÕES: Instale a extensão e informe sua licença.`;
      toastMsg = "✅ Todos os dados copiados!";
    }

    copyToClipboard(text, toastMsg);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 3000);
  };

  return (
    <div className="glass rounded-2xl border-primary/30 bg-primary/5 p-6 neon-glow animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">🎉 LICENÇA GERADA COM SUCESSO!</h3>
            <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Gerador de Entrega Profissional</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-background/40 p-4 border border-white/5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Produto:</span>
            <span className="font-bold">{deliveryData.productName}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Plano:</span>
            <span className="font-bold text-primary">{deliveryData.planName}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Validade:</span>
            <span className="font-bold">{deliveryData.planDuration}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Dispositivos:</span>
            <span className="font-bold">{deliveryData.maxDevices}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-bold text-green-400">{deliveryData.licenseStatus}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            className="w-full justify-start gap-3 h-12 rounded-xl text-xs font-bold uppercase tracking-wider" 
            variant="neon"
            onClick={() => handleCopy("message")}
          >
            {copiedType === "message" ? <ClipboardCheck className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            Copiar Mensagem Completa
          </Button>

          <Button
            className="w-full justify-start gap-3 h-12 rounded-xl text-xs font-bold uppercase tracking-wider"
            variant="neonOutline"
            onClick={() => handleCopy("sales")}
          >
            {copiedType === "sales" ? <ClipboardCheck className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            Copiar Texto de Vendas
          </Button>


          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="neonOutline" 
              className="gap-2 rounded-xl text-[0.6rem] h-10 uppercase font-bold"
              onClick={() => handleCopy("token")}
            >
              {copiedType === "token" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copiar Licença
            </Button>
            <Button 
              variant="ghost" 
              className="gap-2 rounded-xl text-[0.6rem] h-10 uppercase font-bold border border-white/10"
              onClick={() => handleCopy("all")}
            >
              {copiedType === "all" ? <Check className="h-3 w-3" /> : <ClipboardCheck className="h-3 w-3" />}
              Copiar Tudo
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/5 bg-black/40 p-3">
        <p className="text-[0.6rem] font-bold uppercase text-muted-foreground mb-2">Prévia da Mensagem</p>
        <pre className="max-h-32 overflow-y-auto text-[0.6rem] text-muted-foreground/80 whitespace-pre-wrap no-scrollbar">
          {message}
        </pre>
      </div>
    </div>
  );
}
