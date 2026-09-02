import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "msk-selftest-3d9f2b7c";

export const Route = createFileRoute("/api/public/pix-selftest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (new URL(request.url).searchParams.get("t") !== TOKEN) {
          return new Response("forbidden", { status: 403 });
        }
        const { AtomoPayService } = await import("@/lib/payments/atomo-pay.server");
        const svc: any = await AtomoPayService.create();
        const raw: any = await (svc as any).call?.("GET", "/products/sq1cm4jzxh");
        return Response.json(raw ?? { note: "call is private" });
      },
      POST: async ({ request }) => {
        if (request.headers.get("x-msk-selftest") !== TOKEN) {
          return new Response("forbidden", { status: 403 });
        }
        const body = (await request.json().catch(() => ({}))) as {
          amountCents?: number;
          provider?: string;
        };
        if ((body as any).newprod) {
          const { AtomoPayService } = await import("@/lib/payments/atomo-pay.server");
          const svc: any = await AtomoPayService.create();
          const created: any = await svc["call"]("POST", "/products", {
            title: `MSK Premium ${Date.now()}`, cover: "https://msksystem.online/favicon.png", sale_page: "https://msksystem.online",
            payment_type: 1, product_type: "digital", delivery_type: 1, id_category: 1, amount: 8495,
          });
          const prod = created?.data ?? created;
          const ph = String(prod?.hash ?? "");
          const off: any = await svc["call"]("POST", `/products/${ph}/offers`, { title: "MSK unit 8495", price: 8495 });
          const o = off?.data ?? off;
          const oh = String(o?.hash ?? "");
          let tx: any = null; let err: string | null = null;
          try {
            const raw: any = await svc["call"]("POST", "/transactions", {
              amount: 16990, offer_hash: oh, payment_method: "pix",
              customer: { name: "Teste MSK", email: "teste@msksystem.online", phone: "11943213342", document: "19100000000", document_type: "cpf", street_name: "Rua Teste", number: "1", complement: "", neighborhood: "Centro", city: "Sao Paulo", state: "SP", zip_code: "01001000" },
              cart: [{ product_hash: ph, offer_hash: oh, title: "Teste MSK", cover: null, price: 8495, quantity: 2, operation_type: 1, tangible: false }],
              expire_in_days: 1, transaction_origin: "api",
            });
            const t = raw?.data ?? raw;
            tx = { amount: t?.amount, status: t?.payment_status, hasPix: Boolean(t?.pix?.pix_qr_code) };
          } catch (e) { err = (e as Error).message; }
          return Response.json({ productHash: ph, offerHash: oh, offerStatus: o?.status, tx, err });
        }
        if ((body as any).put) {
          const { AtomoPayService } = await import("@/lib/payments/atomo-pay.server");
          const svc: any = await AtomoPayService.create();
          const out: any = {};
          const [h, price] = String((body as any).put).split(":");
          for (const m of ["PUT", "PATCH"]) {
            try { out[m] = await svc["call"](m, `/products/sq1cm4jzxh/offers/${h}`, { title: `MSK unit ${price}`, price: Number(price) }); break; }
            catch (e) { out[m] = (e as Error).message; }
          }
          return Response.json(out);
        }
        if ((body as any).del) {
          const { AtomoPayService } = await import("@/lib/payments/atomo-pay.server");
          const svc: any = await AtomoPayService.create();
          const out: any = {};
          for (const h of String((body as any).del).split(",")) {
            try { out[h] = await svc["call"]("DELETE", `/products/sq1cm4jzxh/offers/${h}`); }
            catch (e) { out[h] = (e as Error).message; }
          }
          return Response.json(out);
        }
        if ((body as any).unit) {
          const { AtomoPayService } = await import("@/lib/payments/atomo-pay.server");
          const svc: any = await AtomoPayService.create();
          const unit = Number((body as any).unit);
          const total = Number((body as any).total);
          let offerHash = String((body as any).offerHash ?? "");
          if (!offerHash) {
            const created: any = await svc["call"]("POST", "/products/sq1cm4jzxh/offers", { title: `MSK unit ${unit}`, price: unit });
            const o = created?.data ?? created;
            offerHash = String(o?.hash ?? "");
            return Response.json({ createdOffer: o });
          }
          const qty = Math.round(total / unit);
          const raw: any = await svc["call"]("POST", "/transactions", {
            amount: total,
            offer_hash: offerHash,
            payment_method: "pix",
            customer: { name: "Teste MSK", email: "teste@msksystem.online", phone: "11943213342", document: "19100000000", document_type: "cpf", street_name: "Rua Teste", number: "1", complement: "", neighborhood: "Centro", city: "Sao Paulo", state: "SP", zip_code: "01001000" },
            cart: [{ product_hash: "sq1cm4jzxh", offer_hash: offerHash, title: "Teste MSK", cover: null, price: unit, quantity: qty, operation_type: 1, tangible: false }],
            expire_in_days: 1,
            transaction_origin: "api",
          });
          const tx = raw?.data ?? raw;
          return Response.json({ amount: tx?.amount, status: tx?.payment_status, hasPix: Boolean(tx?.pix?.pix_qr_code) });
        }
        if ((body as any).probe) {
          const { AtomoPayService } = await import("@/lib/payments/atomo-pay.server");
          const svc: any = await AtomoPayService.create();
          const amt = Number((body as any).probe);
          const raw = await svc["call"]("POST", "/transactions", {
            amount: amt,
            offer_hash: "pqhiz",
            payment_method: "pix",
            customer: { name: "Teste MSK", email: "teste@msksystem.online", phone: "11943213342", document: "19100000000", document_type: "cpf", street_name: "Rua Teste", number: "1", complement: "", neighborhood: "Centro", city: "Sao Paulo", state: "SP", zip_code: "01001000" },
            cart: [{ product_hash: "sq1cm4jzxh", offer_hash: "pqhiz", title: "Teste MSK", cover: null, price: amt, quantity: 1, operation_type: 1, tangible: false }],
            expire_in_days: 1,
            transaction_origin: "api",
          });
          return Response.json({ amount: raw?.amount ?? raw?.data?.amount, status: raw?.payment_status ?? raw?.data?.payment_status, hash: raw?.hash ?? raw?.data?.hash });
        }
        if ((body as any).rawcard) {
          const { AtomoPayService } = await import("@/lib/payments/atomo-pay.server");
          const svc: any = await AtomoPayService.create();
          const variants: Record<string, any> = {
            v_flat: { card_number: "4111111111111111", card_holder_name: "TESTE MSK", card_expiration_month: 12, card_expiration_year: 2030, card_cvv: "123" },
            v_nested: { card: { number: "4111111111111111", holder_name: "TESTE MSK", exp_month: 12, exp_year: 2030, cvv: "123" } },
            v_hash: { card_hash: "test" },
          };
          const out: Record<string, string> = {};
          for (const [k, extra] of Object.entries(variants)) {
            try {
              const r = await svc["call"]("POST", "/transactions", {
                amount: 1000, offer_hash: "sq1cm4jzxh_kbyqro62tg", payment_method: "credit_card", installments: 1,
                customer: { name: "Teste MSK", email: "teste@msksystem.online", phone: "11943213342", document: "19100000000", document_type: "cpf", street_name: "Rua Teste", number: "1", complement: "", neighborhood: "Centro", city: "Sao Paulo", state: "SP", zip_code: "01001000" },
                cart: [{ product_hash: "sq1cm4jzxh", offer_hash: "sq1cm4jzxh_kbyqro62tg", title: "Teste MSK", cover: null, price: 1000, quantity: 1, operation_type: 1, tangible: false }],
                transaction_origin: "api", ...extra,
              });
              out[k] = JSON.stringify(r).slice(0, 400);
            } catch (e) { out[k] = (e as Error).message.slice(0, 400); }
          }
          return Response.json(out);
        }
        if ((body as any).card) {
          const c = (body as any).card as any;
          const { createAtomoCardTransaction } = await import("@/lib/payments/atomo-card.server");
          try {
            const out = await createAtomoCardTransaction({
              identifier: `SELFTEST-CARD-${Date.now()}`,
              amountCents: Math.max(100, Math.round(Number(c.amountCents ?? 100))),
              installments: Number(c.installments ?? 1),
              customer: { name: "Teste MSK", email: "teste@msksystem.online", phone: "11943213342", document: "19100000000" },
              card: {
                number: String(c.number ?? "4111111111111111"),
                holderName: String(c.holderName ?? "TESTE MSK"),
                expMonth: Number(c.expMonth ?? 12),
                expYear: Number(c.expYear ?? 2030),
                cvv: String(c.cvv ?? "123"),
              },
            });
            return Response.json({ ok: true, ...out });
          } catch (e) {
            return Response.json({ ok: false, error: (e as Error).message });
          }
        }
        if ((body as any).list) {
          const { AtomoPayService } = await import("@/lib/payments/atomo-pay.server");
          const svc: any = await AtomoPayService.create();
          const raw = await svc["call"]("GET", "/products/sq1cm4jzxh");
          return Response.json(raw);
        }
        const amountCents = Math.max(100, Math.round(Number(body.amountCents ?? 100)));
        const { createPixWithFailover } = await import("@/lib/payments/gateway.server");
        try {
          const out = await createPixWithFailover(
            {
              identifier: `SELFTEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              amountCents,
              customer: {
                name: "Teste MSK",
                email: "teste@msksystem.online",
                phone: "11943213342",
                document: { number: "19100000000", type: "CPF" },
              },
              items: [
                { title: "Teste MSK", unitPrice: amountCents, quantity: 1, tangible: false },
              ],
              metadata: { selftest: true },
            },
            (body.provider as never) ?? null,
          );
          return Response.json({
            ok: true,
            amountCents,
            provider: out.provider,
            hasCode: Boolean(out.pixCode),
          });
        } catch (e) {
          return Response.json({ ok: false, amountCents, error: (e as Error).message });
        }
      },
    },
  },
});
