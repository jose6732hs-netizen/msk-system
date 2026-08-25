import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ClipboardCheck, Copy, KeyRound, Loader2, MessageSquare, ShieldCheck, X } from "lucide-react";
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
import { adminGenerateToken, adminGetLicenseDetails, adminTokenPlans } from "@/lib/admin.functions";
import { adminTokenUsers } from "@/lib/admin-token-users.functions";
import { generateDeliveryMessage, generateSalesMessage, copyToClipboard } from "@/lib/delivery-message";
import { durationLabelFromMs, resolvePlanDuration } from "@/lib/plan-duration";

type LegacyDuration =
  | "trial15"
  | "trial60"
  | "day1"
  | "day7"
  | "day30"
  | "day90"
  | "day365"
  | "lifetime"
  | "custom";

function legacyDurationForPlan(plan: any): {
  duration: LegacyDuration;
  customDays?: number;
  customMinutes?: number;
} {
  const resolved = resolvePlanDuration(plan);
  if (resolved.lifetime) return { duration: "lifetime" };
  if (resolved.unit === "minutes" && resolved.value === 15) return { duration: "trial15" };
  if (resolved.unit === "minutes" && resolved.value === 60) return { duration: "trial60" };
  if (resolved.unit === "days" && resolved.value === 1) return { duration: "day1" };
  if (resolved.unit === "days" && resolved.value === 7) return { duration: "day7" };
  if (resolved.unit === "days" && resolved.value === 30) return { duration: "day30" };
  if (resolved.unit === "days" && resolved.value === 90) return { duration: "day90" };
  if (resolved.unit === "days" && resolved.value === 365) return { duration: "day365" };
  if (resolved.unit === "days" && resolved.value) return { duration: "custom", customDays: resolved.value };
  return {
    duration: "custom",
    customMinutes: Math.max(1, Math.round((resolved.milliseconds ?? 60_000) / 60_000)),
  };
}

function safePlanDuration(plan: any) {
  try {
    return resolvePlanDuration(plan).label;
  } catch {
    return plan?.duration_label || "Validade não configurada";
  }
}

export function AdminTokenGenerator({
  initialIssued,
  onReset,
}: {
  initialIssued?: { token: string; email: string; licenseId: string } | null;
  onReset?: () => void;
}) {
  const plansFn = useServerFn(adminTokenPlans);
  const usersFn = useServerFn(adminTokenUsers);
  const generateFn = useServerFn(adminGenerateToken);

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["admin-token-plans"],
    queryFn: () => plansFn(),
  });
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-token-users"],
    queryFn: () => usersFn(),
  });

  const plans = plansData?.plans ?? [];
  const users = usersData?.users ?? [];

  const [email, setEmail] = useState("");
  const [standalone, setStandalone] = useState(false);
  const [planId, setPlanId] = useState("");
  const [maxDevices, setMaxDevices] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [issued, setIssued] = useState<{ token: string; email: string; licenseId: string } | null>(
    initialIssued || null,
  );

  useEffect(() => {
    if (!planId && plans[0]?.id) setPlanId(plans[0].id as string);
  }, [planId, plans]);

  useEffect(() => {
    if (initialIssued) setIssued(initialIssued);
  }, [initialIssued]);

  const selectedPlan = useMemo(
    () => plans.find((p: any) => p.id === planId) ?? plans[0] ?? null,
    [plans, planId],
  );

  const selectedDuration = selectedPlan ? safePlanDuration(selectedPlan) : "—";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan?.id) {
      toast.error("Selecione um plano válido.");
      return;
    }
    if (!standalone && !email) {
      toast.error("Selecione um usuário cadastrado.");
      return;
    }

    let legacy: ReturnType<typeof legacyDurationForPlan>;
    try {
      legacy = legacyDurationForPlan(selectedPlan);
    } catch (err) {
      toast.error((err as Error).message);
      return;
    }

    setLoading(true);
    try {
      const res = await generateFn({
        data: {
          ...(standalone ? { standalone: true } : { email }),
          planId: selectedPlan.id,
          ...legacy,
          ...(maxDevices ? { maxDevices: Number(maxDevices) } : {}),
          ...(note ? { note } : {}),
        },
      });
      setIssued({
        token: res.token,
        email: res.user.email ?? (standalone ? "Licença sem usuário" : email),
        licenseId: res.licenseId,
      });
      setCopied(false);
      toast.success(`Licença ${res.durationLabel ?? selectedDuration} gerada corretamente.`);
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

  function resetIssued() {
    setIssued(null);
    onReset?.();
  }

  return (
    <div className="space-y-6">
      {issued && (
        <div className="mb-6">
          <div className="mb-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetIssued} className="text-xs">
              <X className="mr-1 h-3 w-3" /> Limpar entrega
            </Button>
          </div>
          <TokenDeliveryCard
            licenseId={issued.licenseId}
            fullToken={issued.token === "Carregando..." ? null : issued.token}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Gerar licença manual</h2>
          <p className="text-xs text-muted-foreground">
            A validade agora é definida pelo plano escolhido. Não existe mais combinação diária + 30 dias.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={standalone}
            onChange={(e) => {
              setStandalone(e.target.checked);
              if (e.target.checked) setEmail("");
            }}
          />
          <span>
            Licença sem usuário vinculado
            <span className="block text-xs text-muted-foreground">
              Use somente para QA/homologação. Para clientes, selecione uma conta cadastrada abaixo.
            </span>
          </span>
        </label>

        {!standalone && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tk-email">E-mail do usuário</Label>
            <Select value={email} onValueChange={setEmail}>
              <SelectTrigger id="tk-email" className="h-11 w-full">
                {usersLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando todos os usuários...
                  </span>
                ) : (
                  <SelectValue placeholder="Selecione um e-mail cadastrado" />
                )}
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.email}>
                    <div className="flex flex-col">
                      <span className="font-medium">{u.email}</span>
                      {u.name ? <span className="text-[10px] text-muted-foreground">{u.name}</span> : null}
                    </div>
                  </SelectItem>
                ))}
                {!usersLoading && users.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhum usuário com e-mail foi encontrado.
                  </div>
                ) : null}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {users.length} conta(s) com e-mail encontradas, incluindo cadastros via Google/Apple.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="tk-plan">Plano</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger id="tk-plan" className="h-11 w-full">
              {plansLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando planos...
                </span>
              ) : (
                <SelectValue placeholder="Escolha o plano" />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {plans.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {Number(p.price) > 0 ? `R$ ${Number(p.price).toFixed(2)}` : "Grátis"} • {safePlanDuration(p)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Validade</Label>
          <div className="flex h-11 items-center rounded-md border border-primary/25 bg-primary/5 px-3 text-sm font-bold text-primary">
            {selectedDuration}
          </div>
          <p className="text-[11px] text-muted-foreground">Automática e bloqueada conforme o plano selecionado.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tk-dev">Máx. dispositivos (opcional)</Label>
          <Input
            id="tk-dev"
            type="number"
            min={1}
            placeholder={selectedPlan?.max_devices ? `Padrão: ${selectedPlan.max_devices}` : "Padrão do plano"}
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
          <Button type="submit" variant="neon" disabled={loading || plansLoading || (!standalone && !email)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar licença"}
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
        </div>
      )}
    </div>
  );
}

function TokenDeliveryCard({
  licenseId,
  fullToken: propToken,
}: {
  licenseId?: string;
  fullToken?: string | null;
}) {
  const getDetailsFn = useServerFn(adminGetLicenseDetails);
  const [copiedType, setCopiedType] = useState<"token" | "message" | "all" | "sales" | null>(null);

  const { data: license, isLoading } = useQuery({
    queryKey: ["admin-license-details", licenseId],
    queryFn: () => getDetailsFn({ data: { licenseId: licenseId! } }),
    enabled: !!licenseId,
    refetchInterval: 15_000,
  });

  const fullToken = propToken || license?.fullToken || "";

  const deliveryData = useMemo(() => {
    if (!license || !fullToken) return null;

    const plan = license.plans;
    const metadata = (license.metadata ?? {}) as Record<string, any>;
    const isTrial = license.type === "trial" || license.type === "test";
    const pendingMs = Number(metadata["pending_duration_ms"] ?? 0);
    const expired = !!license.expires_at && new Date(license.expires_at).getTime() <= Date.now();

    let duration = durationLabelFromMs(pendingMs);
    if (!duration && license.expires_at && license.activated_at) {
      duration = durationLabelFromMs(
        new Date(license.expires_at).getTime() - new Date(license.activated_at).getTime(),
      );
    }
    if (!duration) {
      try {
        duration = resolvePlanDuration(plan ?? metadata).label;
      } catch {
        duration = metadata["plan_duration_label_snapshot"] ?? "Validade não identificada";
      }
    }

    const isLifetime = (() => {
      try {
        return resolvePlanDuration(plan ?? metadata).lifetime;
      } catch {
        return false;
      }
    })();

    const activationInfo = license.activated_at
      ? new Date(license.activated_at).toLocaleString("pt-BR")
      : "Começa na primeira ativação";

    const expirationInfo = isLifetime
      ? "VITALÍCIA"
      : license.expires_at
        ? new Date(license.expires_at).toLocaleString("pt-BR")
        : pendingMs > 0
          ? `Será definida na ativação (${duration})`
          : "Aguardando ativação";

    const status = expired
      ? "🟡 Expirada"
      : license.status === "active"
        ? "🟢 Ativa"
        : license.status === "inactive"
          ? "⏳ Aguardando ativação"
          : license.status === "revoked"
            ? "🔴 Revogada"
            : license.status === "suspended"
              ? "🚫 Suspensa"
              : String(license.status ?? "—");

    return {
      productName: "MSK Suite - Extensão Premium",
      planName: plan?.name || metadata["plan_name_snapshot"] || (isTrial ? "Teste Gratuito" : "Manual"),
      planDuration: isLifetime ? "VITALÍCIA" : duration,
      maxDevices: license.max_devices || 1,
      licenseKey: fullToken,
      activationInfo,
      expirationInfo,
      isTrial,
      licenseStatus: status,
    };
  }, [license, fullToken]);

  const message = useMemo(
    () => (deliveryData ? generateDeliveryMessage(deliveryData) : ""),
    [deliveryData],
  );
  const salesMessage = useMemo(
    () => (deliveryData ? generateSalesMessage(deliveryData) : ""),
    [deliveryData],
  );

  if (!licenseId || isLoading || !deliveryData) return null;

  const handleCopy = (type: "token" | "message" | "all" | "sales") => {
    let text = "";
    let toastMsg = "";

    if (type === "token") {
      text = fullToken;
      toastMsg = "✅ Licença copiada!";
    } else if (type === "message") {
      text = message;
      toastMsg = "✅ Mensagem completa copiada!";
    } else if (type === "sales") {
      text = salesMessage;
      toastMsg = "✅ Texto de vendas copiado!";
    } else {
      text = `PRODUTO: ${deliveryData.productName}\nPLANO: ${deliveryData.planName}\nLICENÇA: ${fullToken}\nVALIDADE: ${deliveryData.planDuration}\nDISPOSITIVOS: ${deliveryData.maxDevices}\nSTATUS: ${deliveryData.licenseStatus}`;
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
            <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              Dados calculados pela licença real
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-white/5 bg-background/40 p-4">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">Plano:</span>
            <span className="text-right font-bold text-primary">{deliveryData.planName}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">Validade:</span>
            <span className="text-right font-bold">{deliveryData.planDuration}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">Expiração:</span>
            <span className="text-right font-bold">{deliveryData.expirationInfo}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">Dispositivos:</span>
            <span className="font-bold">{deliveryData.maxDevices}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">Status:</span>
            <span className="text-right font-bold">{deliveryData.licenseStatus}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            className="h-12 w-full justify-start gap-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            variant="neon"
            onClick={() => handleCopy("message")}
          >
            {copiedType === "message" ? <ClipboardCheck className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            Copiar Mensagem Completa
          </Button>
          <Button
            className="h-12 w-full justify-start gap-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            variant="neonOutline"
            onClick={() => handleCopy("sales")}
          >
            {copiedType === "sales" ? <ClipboardCheck className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            Copiar Texto de Vendas
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="neonOutline"
              className="h-10 gap-2 rounded-xl text-[0.6rem] font-bold uppercase"
              onClick={() => handleCopy("token")}
            >
              {copiedType === "token" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copiar Licença
            </Button>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-xl border border-white/10 text-[0.6rem] font-bold uppercase"
              onClick={() => handleCopy("all")}
            >
              {copiedType === "all" ? <Check className="h-3 w-3" /> : <ClipboardCheck className="h-3 w-3" />}
              Copiar Tudo
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/5 bg-black/40 p-3">
        <p className="mb-2 text-[0.6rem] font-bold uppercase text-muted-foreground">Prévia da mensagem</p>
        <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap text-[0.6rem] text-muted-foreground/80 no-scrollbar">
          {message}
        </pre>
      </div>
    </div>
  );
}
