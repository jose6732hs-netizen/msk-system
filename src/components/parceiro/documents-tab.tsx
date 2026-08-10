import React, { useState } from "react";
import { ShieldCheck, Lock, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentUploadCard } from "./document-upload-card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { submitAffiliateDocuments } from "@/lib/affiliate.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DocumentsTabProps {
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export function DocumentsTab({ status }: DocumentsTabProps) {
  const queryClient = useQueryClient();
  const submitDocs = useServerFn(submitAffiliateDocuments);
  const [uploads, setUploads] = useState<Record<string, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiredDocs = [
    { id: 'selfie', name: 'Selfie com Documento' },
    { id: 'document_front', name: 'Documento (Frente)' },
    { id: 'document_back', name: 'Documento (Verso)' },
  ];

  const handleUpload = (id: string, file: File) => {
    setUploads(prev => ({ ...prev, [id]: file }));
  };

  const handleRemove = (id: string) => {
    setUploads(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const allUploaded = requiredDocs.every(doc => uploads[doc.id]);

  const [exportProgress, setExportProgress] = useState(0);

  const handleSubmit = async () => {
    if (!allUploaded) return;
    setIsSubmitting(true);
    setExportProgress(0);

    try {
      // Simulação de "Exportando"
      const interval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 200);

      const filePaths: Record<string, string> = {};
      
      // 1. Upload each file to storage
      for (const doc of requiredDocs) {
        const file = uploads[doc.id];
        if (!file) throw new Error(`Documento ${doc.name} não selecionado`);
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${doc.id}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `kyc/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('affiliate-docs')
          .upload(filePath, file);

        if (uploadError) throw new Error(`Erro ao enviar ${doc.name}: ${uploadError.message}`);
        filePaths[doc.id] = filePath;
      }

      // Finaliza o progresso
      clearInterval(interval);
      setExportProgress(100);
      await new Promise(r => setTimeout(r, 500));

      // 2. Submit paths to server
      await submitDocs({
        data: {
          selfie: filePaths['selfie'],
          document_front: filePaths['document_front'],
          document_back: filePaths['document_back'],
        }
      });

      toast.success("Documentos enviados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["affiliate-overview"] });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao enviar documentos");
      setExportProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusConfig = {
    WAITING: { label: "Aguardando envio de documentos", color: "bg-white/5 border-white/10 text-white/40", description: "Envie sua selfie com documento para começar." },
    PENDING: { label: "Documentos em análise", color: "bg-amber-500/10 border-amber-500/20 text-amber-500", description: "Estamos revisando seus documentos. Isso leva até 24h." },
    APPROVED: { label: "Aprovado – Afiliação liberada", color: "bg-green-500/10 border-green-500/20 text-green-500", description: "Tudo certo! Você já pode realizar saques." },
    REJECTED: { label: "Reprovado – Reenvie os documentos", color: "bg-red-500/10 border-red-500/20 text-red-500", description: "Documento ilegível ou inválido. Por favor, tente novamente." },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Info */}
      <section className="bg-[#0F0F0F] border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full -mr-32 -mt-32" />
        <div className="relative z-10">
          <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 text-xs font-bold uppercase tracking-widest", currentStatus.color)}>
             <div className={cn("w-1.5 h-1.5 rounded-full", status === 'WAITING' ? "bg-white/20" : "animate-pulse", status === 'PENDING' && "bg-amber-500", status === 'APPROVED' && "bg-green-500", status === 'REJECTED' && "bg-red-500")} />
             {currentStatus.label}
          </div>
          <h2 className="text-3xl font-bold mb-2">Documentação</h2>
          <p className="text-white/40 max-w-xl">{currentStatus.description}</p>
        </div>
      </section>

      {/* Progress Tracker */}
      <section className="bg-[#0F0F0F] border border-white/10 p-8 rounded-[2.5rem]">
        <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
          {[
            { step: 1, label: "Envio", active: status === 'WAITING' || status === 'REJECTED' },
            { step: 2, label: "Análise", active: status === 'PENDING' },
            { step: 3, label: "Aprovação", active: status === 'APPROVED' },
            { step: 4, label: "Liberado", active: status === 'APPROVED' },
          ].map((item, i) => (
            <div key={i} className="flex flex-1 items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold border transition-all",
                item.active ? "bg-primary border-primary text-primary-foreground" : "bg-white/5 border-white/10 text-white/20"
              )}>
                {status === 'APPROVED' && item.step < 4 ? <CheckCircle2 size={20} /> : item.step}
              </div>
              <div className="flex-1">
                <p className={cn("text-xs font-bold uppercase tracking-widest", item.active ? "text-white" : "text-white/20")}>{item.label}</p>
                {i < 3 && <div className="h-0.5 w-full bg-white/5 mt-2 md:hidden" />}
              </div>
              {i < 3 && <ArrowRight size={16} className="hidden md:block text-white/10" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-white/20 bg-white/5 p-4 rounded-xl italic">
          * Você só poderá acessar a área financeira e começar a indicar após a aprovação dos documentos.
        </p>
      </section>

      {/* Upload Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requiredDocs.map(doc => (
          <DocumentUploadCard 
            key={doc.id}
            id={doc.id}
            name={doc.name}
            status={status}
            onUpload={handleUpload}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Actions & Footer */}
      <div className="flex flex-col items-center gap-8 py-8">
        <div className="flex flex-col gap-4 w-full max-w-md">
          {isSubmitting && (
            <div className="space-y-2 mb-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary">
                <span>Exportando documentos...</span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-2 bg-white/5" />
            </div>
          )}

          <Button 
            variant="neon" 
            className="flex-1 h-14 text-lg font-bold rounded-xl"
            disabled={!allUploaded || status === 'PENDING' || status === 'APPROVED' || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={20} />
                {exportProgress === 100 ? 'Finalizando...' : 'Exportando...'}
              </>
            ) : status === 'PENDING' ? 'Em Análise' : 'Enviar Documentos'}
          </Button>
          <Button 
            variant="ghost" 
            className="h-14 px-8 border border-white/10 rounded-xl font-bold text-white/60 hover:text-white"
          >
            Salvar Rascunho
          </Button>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Lock size={14} className="text-primary" />
            <span>Seus documentos são criptografados e usados apenas para verificação de identidade</span>
          </div>
          <a href="#" className="text-primary text-xs font-bold hover:underline">Política de Privacidade</a>
        </div>
      </div>
    </div>
  );
}
