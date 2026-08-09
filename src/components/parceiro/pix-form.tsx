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
}

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

export function PixKeyForm({ initialKey, initialType }: PixKeyFormProps) {
  const [type, setType] = useState("random");
  const [key, setKey] = useState(initialKey || "");
  const updatePix = useServerFn(updateAffiliatePixKey);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key) {
      toast.error("Informe a chave PIX");
      return;
    }

    if (type !== "random") {
      toast.error("Apenas chaves do tipo 'Chave Aleatória' são aceitas no momento.");
      return;
    }
    
    setLoading(true);
    try {
      await updatePix({ data: { type, key } });
      toast.success("Chave PIX atualizada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar chave PIX");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <CheckCircle2 size={20} />
        </div>
        <div>
          <h4 className="font-bold">Dados de Recebimento</h4>
          <p className="text-xs text-white/40">Onde você deseja receber suas comissões.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="text-xs text-white/40 block mb-2 font-medium uppercase tracking-wider">Tipo</label>
            <Select value={type} disabled>
              <SelectTrigger className="bg-black/20 border-white/10 h-12 opacity-50 cursor-not-allowed">
                <SelectValue placeholder="Chave Aleatória" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                <SelectItem value="random">Chave Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-white/40 block mb-2 font-medium uppercase tracking-wider">Chave PIX</label>
            <Input 
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Digite sua chave aqui" 
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
