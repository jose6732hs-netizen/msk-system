import React, { useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Clock, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DocumentUploadCardProps {
  id: string;
  name: string;
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
}

export function DocumentUploadCard({
  id,
  name,
  status,
  rejectionReason,
  onUpload,
  onRemove
}: DocumentUploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (selectedFile: File) => {
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
    onUpload(id, selectedFile);
  };

  const statusConfig = {
    WAITING: { label: "Não enviado", color: "bg-white/5 text-white/40", icon: null },
    PENDING: { label: "Enviado", color: "bg-amber-500/10 text-amber-500", icon: Clock },
    APPROVED: { label: "Aprovado", color: "bg-green-500/10 text-green-500", icon: CheckCircle2 },
    REJECTED: { label: "Reprovado", color: "bg-red-500/10 text-red-500", icon: AlertCircle },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="bg-[#0F0F0F] border border-white/10 rounded-[2rem] p-6 hover:border-white/20 transition-all flex flex-col h-full group">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-white/80">{name}</h4>
        <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5", currentStatus.color)}>
          {currentStatus.icon && <currentStatus.icon size={12} />}
          {currentStatus.label}
        </div>
      </div>

      {file ? (
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/5 flex items-center justify-center">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <FileText className="text-white/20" size={48} />
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  onRemove(id);
                }}
                className="rounded-xl"
              >
                <Trash2 size={16} className="mr-2" /> Remover
              </Button>
            </div>
          </div>
          <p className="text-xs text-white/40 truncate text-center">{file.name}</p>
        </div>
      ) : (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex-1 border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-8 gap-3 text-center",
            isDragging ? "border-primary bg-primary/5" : "border-white/5 hover:border-white/10"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
            <Upload size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-white/60">Arraste ou clique</p>
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mt-1">PNG, JPG ou PDF (5MB)</p>
          </div>
          <input 
            type="file" 
            id={`file-${id}`} 
            className="hidden" 
            accept="image/*,.pdf" 
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-2 text-primary hover:text-primary hover:bg-primary/10 font-bold"
            onClick={() => document.getElementById(`file-${id}`)?.click()}
          >
            Selecionar arquivo
          </Button>
        </div>
      )}

      {status === 'REJECTED' && rejectionReason && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mb-1">Motivo da rejeição</p>
          <p className="text-xs text-red-500/80">{rejectionReason}</p>
        </div>
      )}
    </div>
  );
}
