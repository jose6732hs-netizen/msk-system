import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { setAffiliateWithdrawalPassword } from "@/lib/parceiro/wallet.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WithdrawalPasswordModalProps {
  isAlreadySet?: boolean | undefined;
  onSuccess?: () => void;
}

export function WithdrawalPasswordModal({ isAlreadySet, onSuccess }: WithdrawalPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const setPasswordFn = useServerFn(setAffiliateWithdrawalPassword);

  const handleSupport = () => {
    window.open("https://t.me/seu_suporte", "_blank");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBlocked) {
      toast.error("Acesso bloqueado. Contate o suporte.");
      return;
    }

    if (password.length !== 6 || !/^\d+$/.test(password)) {
      toast.error("A senha deve conter exatamente 6 dígitos numéricos");
      return;
    }

    if (password !== confirmPassword) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setIsBlocked(true);
        toast.error("Muitas tentativas. Acesso bloqueado.");
      } else {
        toast.error(`Senhas não coincidem. Tentativa ${newAttempts} de 3`);
      }
      return;
    }

    setLoading(true);
    try {
      await setPasswordFn({ data: { passwordHash: password } });
      toast.success("Senha de saque configurada com sucesso!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erro ao configurar senha");
    } finally {
      setLoading(false);
    }
  };

  if (isAlreadySet) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h4 className="font-bold text-lg">Segurança Ativa</h4>
            <p className="text-sm text-white/40">Sua senha de saque já está configurada.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button 
            variant="outline" 
            className="border-white/10 text-white/60 hover:text-white" 
            onClick={() => toast.info("Para mudar a senha, entre em contato com o suporte.")}
          >
            Alterar Senha
          </Button>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
        <Lock className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h4 className="text-xl font-bold mb-2">Acesso Bloqueado</h4>
        <p className="text-sm text-white/40 mb-6">Você errou a senha 3 vezes. Por segurança, o acesso foi bloqueado.</p>
        <Button variant="destructive" className="w-full h-12 font-bold rounded-xl" onClick={handleSupport}>
          Contatar Suporte
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Lock size={20} />
        </div>
        <div>
          <h4 className="font-bold">Senha de Saque</h4>
          <p className="text-xs text-white/40">Crie uma senha de 6 dígitos para autorizar saques.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            placeholder="Nova Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
            className="bg-black/20 border-white/10 h-12 text-center tracking-[0.5em] font-bold text-lg"
          />
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            placeholder="Confirmar"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, ""))}
            className="bg-black/20 border-white/10 h-12 text-center tracking-[0.5em] font-bold text-lg"
          />
        </div>

        <p className="text-[10px] text-white/40 italic">
          * Apenas números. Após salvar, a senha não pode ser visualizada — somente o suporte pode redefini-la.
        </p>

        <Button 
          type="submit" 
          variant="neon" 
          className="w-full h-12 font-bold rounded-xl"
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : "Confirmar Senha de Segurança"}
        </Button>
      </form>
    </div>
  );
}