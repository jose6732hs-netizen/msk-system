export type PlanDurationLike = {
  name?: string | null;
  slug?: string | null;
  duration_label?: string | null;
  duration_days?: number | null;
  duration_value?: number | null;
  duration_unit?: string | null;
  is_lifetime?: boolean | null;
  allow_trial?: boolean | null;
  price?: number | null;
};

export type ResolvedPlanDuration = {
  lifetime: boolean;
  milliseconds: number | null;
  value: number | null;
  unit: "minutes" | "hours" | "days" | "weeks" | "months" | "years" | "lifetime";
  label: string;
};

const UNIT_MS: Record<Exclude<ResolvedPlanDuration["unit"], "lifetime">, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
  months: 2_592_000_000,
  years: 31_536_000_000,
};

function normalizeUnit(raw?: string | null): ResolvedPlanDuration["unit"] | null {
  const unit = String(raw ?? "").trim().toLowerCase();
  if (["minute", "minutes", "min", "mins", "minuto", "minutos"].includes(unit)) return "minutes";
  if (["hour", "hours", "hora", "horas"].includes(unit)) return "hours";
  if (["day", "days", "dia", "dias"].includes(unit)) return "days";
  if (["week", "weeks", "semana", "semanas"].includes(unit)) return "weeks";
  if (["month", "months", "mes", "mês", "meses"].includes(unit)) return "months";
  if (["year", "years", "ano", "anos"].includes(unit)) return "years";
  if (["lifetime", "vitalicio", "vitalício"].includes(unit)) return "lifetime";
  return null;
}

function labelFor(value: number, unit: ResolvedPlanDuration["unit"]) {
  if (unit === "lifetime") return "Vitalício";
  const singular = value === 1;
  const names: Record<Exclude<ResolvedPlanDuration["unit"], "lifetime">, [string, string]> = {
    minutes: ["minuto", "minutos"],
    hours: ["hora", "horas"],
    days: ["dia", "dias"],
    weeks: ["semana", "semanas"],
    months: ["mês", "meses"],
    years: ["ano", "anos"],
  };
  return `${value} ${singular ? names[unit][0] : names[unit][1]}`;
}

function parsedFromLabel(label?: string | null): { value: number; unit: Exclude<ResolvedPlanDuration["unit"], "lifetime"> } | null {
  const text = String(label ?? "").trim().toLowerCase();
  if (!text) return null;
  const match = text.match(/(\d+)\s*(min(?:uto)?s?|horas?|dias?|semanas?|mes(?:es)?|m[eê]s(?:es)?|anos?)/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = normalizeUnit(match[2]);
  if (!Number.isFinite(value) || value <= 0 || !unit || unit === "lifetime") return null;
  return { value, unit };
}

/**
 * Resolve a validade do plano sem assumir "30 dias" silenciosamente.
 *
 * O plano FREE/TESTE é uma regra de produto: sempre dura 15 minutos. Essa regra
 * vem antes dos campos legados do banco para impedir que um registro antigo com
 * duration_value=30/days transforme novamente o teste em 30 dias.
 */
export function resolvePlanDuration(plan: PlanDurationLike): ResolvedPlanDuration {
  const identity = `${plan.name ?? ""} ${plan.slug ?? ""}`.toLowerCase();
  const text = `${identity} ${plan.duration_label ?? ""}`.toLowerCase();
  const labelSaysLifetime = /vital[ií]c|lifetime/.test(text);

  if (plan.is_lifetime === true || normalizeUnit(plan.duration_unit) === "lifetime" || labelSaysLifetime) {
    return { lifetime: true, milliseconds: null, value: null, unit: "lifetime", label: "Vitalício" };
  }

  const isFreeTrial =
    /free|gr[aá]tis|teste|trial/.test(identity) ||
    (plan.allow_trial === true && Number(plan.price ?? 0) === 0);
  if (isFreeTrial) {
    return {
      lifetime: false,
      milliseconds: 15 * UNIT_MS.minutes,
      value: 15,
      unit: "minutes",
      label: "15 minutos",
    };
  }

  const parsed = parsedFromLabel(plan.duration_label);
  if (parsed) {
    return {
      lifetime: false,
      milliseconds: parsed.value * UNIT_MS[parsed.unit],
      value: parsed.value,
      unit: parsed.unit,
      label: labelFor(parsed.value, parsed.unit),
    };
  }

  const explicitValue = Number(plan.duration_value ?? 0);
  const explicitUnit = normalizeUnit(plan.duration_unit);
  if (explicitValue > 0 && explicitUnit && explicitUnit !== "lifetime") {
    return {
      lifetime: false,
      milliseconds: explicitValue * UNIT_MS[explicitUnit],
      value: explicitValue,
      unit: explicitUnit,
      label: labelFor(explicitValue, explicitUnit),
    };
  }

  const days = Number(plan.duration_days ?? 0);
  if (days > 0) {
    return {
      lifetime: false,
      milliseconds: days * UNIT_MS.days,
      value: days,
      unit: "days",
      label: labelFor(days, "days"),
    };
  }

  if (/di[aá]ri/.test(text)) {
    return { lifetime: false, milliseconds: UNIT_MS.days, value: 1, unit: "days", label: "1 dia" };
  }
  if (/semanal|7\s*dias?/.test(text)) {
    return { lifetime: false, milliseconds: 7 * UNIT_MS.days, value: 7, unit: "days", label: "7 dias" };
  }
  if (/trimestral|90\s*dias?/.test(text)) {
    return { lifetime: false, milliseconds: 90 * UNIT_MS.days, value: 90, unit: "days", label: "90 dias" };
  }
  if (/mensal|30\s*dias?/.test(text)) {
    return { lifetime: false, milliseconds: 30 * UNIT_MS.days, value: 30, unit: "days", label: "30 dias" };
  }

  throw new Error(`O plano "${plan.name ?? plan.slug ?? "selecionado"}" não possui uma validade válida configurada.`);
}

export function durationArgs(duration: ResolvedPlanDuration) {
  if (duration.lifetime || !duration.milliseconds) return {};
  if (duration.milliseconds % 86_400_000 === 0) {
    return { durationDays: Math.round(duration.milliseconds / 86_400_000) };
  }
  return { durationMinutes: Math.round(duration.milliseconds / 60_000) };
}

export function durationLabelFromMs(milliseconds?: number | null) {
  const ms = Number(milliseconds ?? 0);
  if (!(ms > 0)) return null;
  if (ms % 86_400_000 === 0) return labelFor(Math.round(ms / 86_400_000), "days");
  if (ms % 3_600_000 === 0) return labelFor(Math.round(ms / 3_600_000), "hours");
  return labelFor(Math.round(ms / 60_000), "minutes");
}
