import { z } from "zod";

export const licenseAction = z.object({
  licenseId: z.string().uuid(),
  action: z.enum(["revoke", "suspend", "reactivate", "extend"]),
  reason: z.string().max(240).optional(),
  days: z.number().int().min(1).max(3650).optional(),
});

export const planSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().max(40).optional(),
    name: z.string().min(2).max(60),
    description: z.string().max(400).default(""),
    price: z.number().min(0),
    currency: z.string().min(3).max(3).default("BRL"),
    duration_label: z.string().max(40).default(""),
    duration_days: z.number().int().min(1).nullable(),
    duration_unit: z.enum(["minutes", "hours", "days", "weeks", "months", "lifetime"]).default("days"),
    duration_value: z.number().int().min(1).default(30),
    is_lifetime: z.boolean().default(false),
    auto_renew: z.boolean().default(true),
    max_devices: z.number().int().min(1).max(100).default(1),
    active: z.boolean().default(true),
    sort_order: z.number().int().default(0),
    image_url: z.string().max(4000).default("").optional(),
    affiliate_commission_rate: z.number().min(0).max(100).default(0),
    affiliate_commission_fixed: z.number().min(0).default(0),
  })
  .transform((p) => {
    const base = (p.slug ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const fromName = p.name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = (base || fromName || `plano-${Date.now()}`).slice(0, 40);
    return { ...p, slug };
  });

export const providerSchema = z.enum(["amplopay", "sigilopay", "atomopay"]);
