import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateAffiliatePixKey } from "@/lib/parceiro/wallet.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface PixKeyFormProps {
  initialKey?: string | null | undefined;
  initialType?: string | null | undefined;
  onSaved?: (() => void) | undefined;
}

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
] as const;

const PLACEHOLDERS: Record<string, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "voce@email.com",
  phone: "(11) 99999-9999",
  random: "chave aleatória (EVP)",
};

function validateKey(type: string, raw: string): string | null {
  const value = raw.trim();
  const digits = value.replace(/\D/g, "");
  switch (type) {
    case "cpf":
      return digits.length === 11 ? null : "CPF deve ter 11 dígitos.";
    case "cnpj":
      return digits.length === 14 ? null : "CNPJ deve ter 14 dígitos.";
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? null : "E-mail inválido.";
    case "phone":
      return digits.length >= 10 && digits.length <= 13 ? null : "Telefone inválido (DDD + número).";
    case "random":
      return value.length >= 8 ? null : "Chave aleatória inválida.";
    default:
      return "Selecione o tipo da chave.";
  }
}

export function PixKeyForm({ initialKey, initialType, onSaved }: PixKeyFormProps) {
  const [type, setType] = useState<string>((initialType || "random").toLowerCase());
  const [key, setKey] = useState(initialKey || "");
  const updatePix = useServerFn(updateAffiliatePixKey);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateKey(type, key);
    if (error) {
      toast.error(error);
      return;
    }

    const normalized =
      type === "cpf" || type === "cnpj" || type === "phone" ? key.replace(/\D/g, "") : key.trim();

    setLoading(true);
    try {
      await updatePix({ data: { type, key: normalized } });
      setKey(normalized);
      toast.success("Chave PIX atualizada com sucesso!");
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar chave PIX");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <CheckCircle2 size={20} />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold">Dados de Recebimento</h4>
          <p className="text-xs text-white/40">Onde você deseja receber suas comissões.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="text-xs text-white/40 block mb-2 font-medium uppercase tracking-wider">Tipo</label>
            <Select value={type} onValueChange={(v) => setType(v)}>
              <SelectTrigger className="bg-black/20 border-white/10 h-12">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10 text-white z-[100010]">
                {PIX_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-white/40 block mb-2 font-medium uppercase tracking-wider">Chave PIX</label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={PLACEHOLDERS[type] ?? "Digite sua chave aqui"}
              className="bg-black/20 border-white/10 h-12"
            />
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex gap-3 items-start">
          <AlertCircle size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed text-white/60">
            Certifique-se de que a chave PIX informada pertence ao titular da conta. Pagamentos para terceiros podem ser bloqueados por segurança.
          </p>
        </div>

        <Button
          type="submit"
          variant="neon"
          className="w-full h-12 font-bold rounded-xl"
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : "Salvar Configuração"}
        </Button>
      </form>
    </div>
  );
}
