import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  MessageSquareText,
  PackageCheck,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { purposeForLicense } from "@/lib/license-purpose";

interface LicenseCardProps {
  license: any;
  token?: string | null;
  busy?: boolean;
  onReveal?: () => void;
  onCopyToken: () => void;
  onGenerateNew?: () => void;
  generating?: boolean;
  highlighted?: boolean;
}

function money(value: unknown, currency = "BRL") {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}

function parseDeliveryFields(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:=]{2,40})\s*[:=]\s*(.+)$/);
      return match ? { label: match[1]!.trim(), value: match[2]!.trim() } : null;
    })
    .filter((field): field is { label: string; value: string } => !!field?.value);
}

export function LicenseCard({
  license,
  token,
  busy,
  onReveal,
  onCopyToken,
  onGenerateNew,
  generating,
  highlighted,
}: LicenseCardProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null);

  useEffect(() => {
    if (!license.expires_at) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const difference = new Date(license.expires_at).getTime() - Date.now();
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false,
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = window.setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => window.clearInterval(timer);
  }, [license.expires_at]);

  const metadata = (license?.metadata ?? {}) as Record<string, any>;
  const purpose = purposeForLicense(license);
  const isDigitalDelivery = purpose.role === "delivery";
  const plan = license?.resolved_plan ?? {
    name: metadata["plan_name_snapshot"] ?? license?.plans?.name ?? null,
    price: metadata["item_unit_price"] ?? metadata["plan_price_snapshot"] ?? license?.plans?.price ?? null,
    currency: metadata["plan_currency_snapshot"] ?? license?.plans?.currency ?? "BRL",
    durationLabel: metadata["plan_duration_label_snapshot"] ?? license?.plans?.duration_label ?? null,
    durationDays: metadata["plan_duration_snapshot"] ?? license?.plans?.duration_days ?? null,
    isLifetime:
      typeof metadata["plan_is_lifetime_snapshot"] === "boolean"
        ? metadata["plan_is_lifetime_snapshot"]
        : Boolean(license?.plans?.is_lifetime),
  };
  const itemLabel = metadata["item_label"] as string | undefined;
  const deliveryMethod = String(metadata["delivery_method"] ?? "panel_email");
  const deliveryLink = String(metadata["delivery_link"] ?? "").trim();
  const deliveryInstructions = String(metadata["delivery_instructions"] ?? "").trim();
  const deliveryFields = parseDeliveryFields(deliveryInstructions);
  const showPanelDelivery = deliveryMethod === "panel" || deliveryMethod === "panel_email";
  const awaitingActivation = !isDigitalDelivery && license.status === "inactive" && !license.expires_at;
  const status = timeLeft?.isExpired ? "expired" : license.status;
  const currency = String(license?.purchase?.currency ?? plan?.currency ?? "BRL");
  const unitPrice = Number(plan?.price);
  const validUnitPrice = Number.isFinite(unitPrice) ? unitPrice : null;
  const totalPaid = Number(license?.purchase?.total_paid);
  const validTotalPaid = Number.isFinite(totalPaid) ? totalPaid : null;
  const licenseCount = Number(license?.purchase?.license_count ?? 1);
  const licenseValue = validUnitPrice ?? (licenseCount === 1 ? validTotalPaid : null);
  const showOrderTotal =
    validTotalPaid !== null &&
    (licenseCount > 1 || licenseValue === null || Math.abs(validTotalPaid - licenseValue) > 0.009);

  const durationText = plan?.isLifetime
    ? "Vitalício"
    : plan?.durationLabel
      ? String(plan.durationLabel)
      : Number(plan?.durationDays) > 0
        ? `${Number(plan.durationDays)} dias`
        : license.expires_at && license.activated_at
          ? `${Math.max(1, Math.round((new Date(license.expires_at).getTime() - new Date(license.activated_at).getTime()) / 86_400_000))} dias`
          : "Conforme o plano adquirido";

  const purchaseDate = license?.purchase?.paid_at ?? license.starts_at ?? license.created_at;
  const expirationText = plan?.isLifetime
    ? "Vitalício"
    : license.expires_at
      ? new Date(license.expires_at).toLocaleDateString("pt-BR")
      : awaitingActivation
        ? "Inicia na ativação"
        : "—";

  async function copyDelivery(value: string, label = "Entrega") {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado.`);
  }

  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-[2.5rem] border transition-all duration-500",
        highlighted
          ? "scale-[1.02] border-primary/50 shadow-2xl shadow-primary/20 ring-2 ring-primary/20"
          : "border-white/10",
        status === "expired" ? "opacity-75 grayscale-[0.5]" : "",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-[100px]",
          status === "active" ? "bg-primary" : status === "expired" ? "bg-red-500" : "bg-amber-500",
        )}
      />

      <div className="relative z-10 p-8 sm:p-10">
        <div className="mb-10 flex flex-col items-start justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-[1.5rem] shadow-lg",
                status === "active"
                  ? "bg-primary/20 text-primary shadow-primary/20"
                  : status === "expired"
                    ? "bg-red-500/20 text-red-500 shadow-red-500/20"
                    : "bg-amber-500/20 text-amber-500 shadow-amber-500/20",
              )}
            >
              {status === "active" ? (
                <ShieldCheck size={32} />
              ) : status === "expired" ? (
                <AlertCircle size={32} />
              ) : (
                <Clock size={32} />
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/60">
                  {isDigitalDelivery ? "Compra" : "Licença"}
                </h3>
                <span className={cn("rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-wider", purpose.accent)}>
                  {purpose.label}
                </span>
                <span
                  className={cn(
                    "rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider",
                    status === "active"
                      ? "bg-green-500/20 text-green-500"
                      : status === "expired"
                        ? "bg-red-500/20 text-red-500"
                        : "bg-amber-500/20 text-amber-500",
                  )}
                >
                  {status === "active" ? (isDigitalDelivery ? "Liberada" : "Ativa") : status === "expired" ? "Expirada" : "Pendente"}
                </span>
              </div>
              <h2 className="flex items-center gap-3 break-words text-3xl font-black uppercase tracking-tighter text-white">
                <Rocket className="h-6 w-6 shrink-0 text-primary" />
                {plan?.name || itemLabel || purpose.label}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                {purpose.description} · Usar em: {purpose.where}
              </p>
            </div>
          </div>

          {status === "expired" ? (
            <Button variant="neon" className="h-12 rounded-xl px-8 text-xs font-black uppercase tracking-wider shadow-xl shadow-primary/20">
              <RefreshCw className="mr-2 h-4 w-4" /> Comprar novamente
            </Button>
          ) : (
            <div className="min-w-[170px] text-left sm:text-right">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40">
                {isDigitalDelivery ? "Valor desta compra" : "Valor desta licença"}
              </span>
              <span className="text-2xl font-black text-white">
                {licenseValue !== null ? money(licenseValue, currency) : "—"}
              </span>
              {showOrderTotal ? (
                <p className="mt-1 text-[10px] font-medium text-white/40">
                  Total pago no pedido: {money(validTotalPaid, currency)}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <InfoItem
            icon={<Calendar className="h-4 w-4" />}
            label="Data da Compra"
            value={purchaseDate ? new Date(purchaseDate).toLocaleDateString("pt-BR") : "—"}
          />
          <InfoItem
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={isDigitalDelivery ? "Liberação" : "Ativação"}
            value={license.activated_at ? new Date(license.activated_at).toLocaleDateString("pt-BR") : "Aguardando"}
          />
          <InfoItem icon={<Clock className="h-4 w-4" />} label="Duração Total" value={durationText} />
          <InfoItem icon={<AlertCircle className="h-4 w-4" />} label="Expiração" value={expirationText} />
        </div>

        {awaitingActivation && (
          <div className="rounded-[2rem] border border-amber-400/30 bg-amber-400/10 p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Clock className="h-6 w-6 text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Aguardando ativação
              </span>
              <p className="max-w-md text-xs font-medium text-white/50">
                A duração exibida acima é a duração exata do plano comprado. A contagem começa apenas quando esta licença for ativada no produto correto.
              </p>
            </div>
          </div>
        )}

        {timeLeft && !plan?.isLifetime && (
          <div
            className={cn(
              "group relative overflow-hidden rounded-[2rem] border p-8 transition-all duration-500",
              status === "expired"
                ? "border-red-500/20 bg-red-500/5"
                : "border-white/10 bg-white/5 hover:border-primary/30",
            )}
          >
            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="flex items-center gap-2">
                <Timer className={cn("h-4 w-4", status === "expired" ? "text-red-500" : "text-primary")} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                  {status === "expired" ? "Tempo Encerrado" : "Tempo Restante da Licença"}
                </span>
              </div>

              {status === "expired" ? (
                <div className="text-center">
                  <h4 className="mb-2 text-3xl font-black uppercase tracking-tighter text-red-500">Acesso bloqueado</h4>
                  <p className="text-xs font-medium text-white/40">Esta licença expirou. Somente uma nova licença válida libera o produto novamente.</p>
                </div>
              ) : (
                <div className="flex gap-4 sm:gap-8">
                  <TimeBlock value={timeLeft.days} label="dias" />
                  <TimeDivider />
                  <TimeBlock value={timeLeft.hours} label="horas" />
                  <TimeDivider />
                  <TimeBlock value={timeLeft.minutes} label="minutos" />
                  <TimeDivider className="hidden sm:flex" />
                  <TimeBlock value={timeLeft.seconds} label="segundos" className="hidden sm:flex" />
                </div>
              )}
            </div>
          </div>
        )}

        {showPanelDelivery ? (
          <div className="mt-8 overflow-hidden rounded-[2rem] border border-blue-400/30 bg-gradient-to-br from-blue-500/[.09] via-black/20 to-violet-500/[.08] shadow-[0_20px_70px_-35px_rgba(59,130,246,.55)]">
            <div className="border-b border-blue-400/15 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-300">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-300">Entrega liberada após o pagamento</p>
                  <h4 className="mt-0.5 text-base font-black text-white">{itemLabel || plan?.name || "Conteúdo liberado"}</h4>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-white">
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <div className="min-w-0 max-w-2xl rounded-2xl rounded-tl-md border border-white/10 bg-white/[.045] px-4 py-3">
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/70">
                    {deliveryInstructions || "Sua compra foi confirmada. Os dados e instruções desta oferta ficam disponíveis aqui no seu painel."}
                  </p>
                </div>
              </div>

              {deliveryFields.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {deliveryFields.map((field, index) => (
                    <div key={`${field.label}-${index}`} className="rounded-xl border border-blue-400/15 bg-black/30 p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-300/80">{field.label}</p>
                      <div className="mt-1.5 flex min-w-0 items-center gap-2">
                        <p className="min-w-0 flex-1 break-all font-mono text-xs font-bold text-white">{field.value}</p>
                        <button
                          type="button"
                          aria-label={`Copiar ${field.label}`}
                          onClick={() => void copyDelivery(field.value, field.label)}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-blue-400/20 bg-blue-500/10 text-blue-300 transition hover:bg-blue-500/20"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {deliveryInstructions ? (
                  <Button size="sm" variant="neonOutline" onClick={() => void copyDelivery(deliveryInstructions, "Entrega")}>
                    <Copy className="mr-2 h-3.5 w-3.5" /> Copiar entrega
                  </Button>
                ) : null}
                {deliveryLink ? (
                  <a
                    href={deliveryLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-[10px] font-black uppercase text-white transition hover:bg-blue-400"
                  >
                    Abrir entrega <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!isDigitalDelivery ? (
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Token de Ativação</p>
            <p className="mb-4 break-all font-mono text-lg text-primary">
              {token ?? license.token_preview ?? "MSK-••••-••••-••••-••••"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="neonOutline" onClick={onReveal} disabled={busy} className="h-9 px-4 text-[10px] font-black uppercase">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} {token ? "Ocultar" : "Revelar"}
              </Button>
              <Button size="sm" variant="neon" onClick={onCopyToken} disabled={!token && !license.token_preview} className="h-9 px-4 text-[10px] font-black uppercase">
                <Copy size={14} /> Copiar
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/5 pt-6">
          {!isDigitalDelivery && onGenerateNew && (
            <Button
              variant="neon"
              onClick={onGenerateNew}
              disabled={generating}
              className="h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Gerar nova licença
            </Button>
          )}
          {license.transaction_id ? (
            <span className="break-all text-[10px] font-bold uppercase tracking-widest text-white/25">
              Pedido #{String(license.transaction_id).slice(0, 8).toUpperCase()}
              {license?.purchase?.method ? ` · ${String(license.purchase.method).replaceAll("_", " ")}` : ""}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
        {icon} {label}
      </div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function TimeBlock({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className={cn("flex min-w-[60px] flex-col items-center", className)}>
      <span className="text-4xl font-black tracking-tighter text-white sm:text-5xl">{String(value).padStart(2, "0")}</span>
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">{label}</span>
    </div>
  );
}

function TimeDivider({ className }: { className?: string }) {
  return <div className={cn("flex items-center pb-4 text-3xl font-thin text-white/10", className)}>:</div>;
}
