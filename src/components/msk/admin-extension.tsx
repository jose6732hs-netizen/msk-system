import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  adminGetReserveExtension,
  adminSaveReserveExtension,
  adminCreateUploadUrl,
  adminDeleteBuild,
  adminListBuilds,
  adminRegisterBuild,
  adminSetBuildPublished,
  adminListExtensionChannels,
  adminSaveExtensionChannel,
} from "@/lib/extension.functions";
import { supabase } from "@/integrations/supabase/client";

function human(bytes?: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function ExtensionChannels() {
  const qc = useQueryClient();
  const list = useServerFn(adminListExtensionChannels);
  const save = useServerFn(adminSaveExtensionChannel);
  const { data, isLoading } = useQuery({ queryKey: ["extension-channels"], queryFn: () => list() });
  const channels = data?.channels ?? [];
  const newestNumber = channels.reduce((max, c) => Math.max(max, c.channel_number ?? 0), 0);

  const mutate = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => save({ data: v }),
    onSuccess: (r) => {
      const status = r.enabled ? "ATIVADO" : "DESATIVADO";
      toast.success(`${r.display_name}: Canal ${status}. Este canal agora é a fonte para novos downloads.`);
      qc.invalidateQueries({ queryKey: ["extension-channels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Canais de extensão</h3>
        <p className="mt-1 text-xs text-muted-foreground">Ative a principal e cada reserva individualmente. Todas usam os tokens MSK deste SaaS.</p>
      </div>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <div className="grid gap-3 lg:grid-cols-3">
          {channels.map((channel) => (
            <div key={channel.id} className="rounded-lg border border-border/60 bg-card/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span>{String(channel.channel_number).padStart(2, "0")} · {channel.display_name}</span>
                    {channel.channel_number === newestNumber && (
                      <span className="rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary">
                        Novo
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{channel.channel_type === "primary" ? "Principal" : "Reserva"} · v{channel.version}</p>
                </div>
                <Switch checked={channel.enabled} disabled={mutate.isPending} onCheckedChange={(enabled) => mutate.mutate({ id: channel.id, enabled })} aria-label={`Ativar ${channel.display_name}`} />
              </div>
              <p className="mt-3 break-all font-mono text-[0.65rem] text-muted-foreground">{channel.chrome_extension_id ? `ID: ${channel.chrome_extension_id}` : "ID Chrome: não informado"}</p>
              <p className={`mt-2 text-xs font-medium ${channel.enabled ? "text-primary" : "text-muted-foreground"}`}>{channel.enabled ? "ATIVA" : "DESATIVADA"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminExtensionTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListBuilds);
  const createUrl = useServerFn(adminCreateUploadUrl);
  const register = useServerFn(adminRegisterBuild);
  const setPublished = useServerFn(adminSetBuildPublished);
  const removeBuild = useServerFn(adminDeleteBuild);

  const { data, isLoading } = useQuery({ queryKey: ["admin-builds"], queryFn: () => list() });

  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = useMutation({
    mutationFn: (v: { buildId: string; publish: boolean }) => setPublished({ data: v }),
    onSuccess: () => {
      toast.success("Versão atualizada.");
      qc.invalidateQueries({ queryKey: ["admin-builds"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (buildId: string) => removeBuild({ data: { buildId } }),
    onSuccess: () => {
      toast.success("Versão removida.");
      qc.invalidateQueries({ queryKey: ["admin-builds"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload() {
    if (!file) {
      toast.error("Selecione o arquivo .zip da extensão.");
      return;
    }
    if (!/\.zip$/i.test(file.name)) {
      toast.error("O arquivo precisa ser .zip.");
      return;
    }
    if (!version.trim()) {
      toast.error("Informe a versão (ex.: 1.4.2).");
      return;
    }
    setBusy(true);
    try {
      const { path, token } = await createUrl({
        data: { version: version.trim(), fileName: file.name },
      });
      const { error } = await supabase.storage
        .from("extension-builds")
        .uploadToSignedUrl(path, token, file, { contentType: "application/zip" });
      if (error) throw new Error(error.message);

      await register({
        data: {
          version: version.trim(),
          fileName: file.name,
          storagePath: path,
          sizeBytes: file.size,
          releaseNotes: notes.trim() || undefined,
          publish: true,
        },
      });
      toast.success("ZIP enviado e publicado para os assinantes.");
      setFile(null);
      setVersion("");
      setNotes("");
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["admin-builds"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <ExtensionChannels />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ext-version">Versão</Label>
            <Input
              id="ext-version"
              placeholder="1.4.2"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext-file">Arquivo .zip da extensão</Label>
            <div className="flex flex-col gap-2">
              <Input
                id="ext-file"
                ref={inputRef}
                type="file"
                accept=".zip,application/zip"
                className="cursor-pointer file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1 file:mr-2"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs font-bold text-primary animate-pulse">
                  Selecionado: {file.name} — {human(file.size)}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ext-notes">Notas da versão (changelog)</Label>
          <Textarea
            id="ext-notes"
            rows={6}
            placeholder="O que mudou nesta versão..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <Button variant="neon" onClick={upload} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        Enviar e publicar ZIP
      </Button>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Versões enviadas</h3>
          <span className="text-xs text-muted-foreground">
            {data?.downloads ?? 0} downloads registrados
          </span>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Versão</th>
                  <th>Arquivo</th>
                  <th>Tamanho</th>
                  <th>Status</th>
                  <th>Enviado em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(data?.builds ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-muted-foreground">
                      Nenhuma versão enviada ainda.
                    </td>
                  </tr>
                )}
                {(data?.builds ?? []).map((b) => (
                  <tr key={b.id} className="border-t border-border/50">
                    <td className="py-2 font-medium">{b.version}</td>
                    <td className="max-w-[220px] truncate">{b.file_name}</td>
                    <td>{human(b.size_bytes)}</td>
                    <td>
                      {b.is_published ? (
                        <span className="text-primary">publicada</span>
                      ) : (
                        <span className="text-muted-foreground">arquivada</span>
                      )}
                    </td>
                    <td>{new Date(b.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {!b.is_published && (
                          <Button
                            size="sm"
                            variant="neon"
                            onClick={() =>
                              toggle.mutate({ buildId: b.id, publish: true })
                            }
                          >
                            Ativar
                          </Button>
                        )}
                        {b.is_published && (
                          <Button
                            size="sm"
                            variant="glass"
                            onClick={() =>
                              toggle.mutate({ buildId: b.id, publish: false })
                            }
                          >
                            Arquivar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => del.mutate(b.id)}
                          aria-label="Excluir versão"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
