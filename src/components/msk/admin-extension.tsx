import { useState } from "react";
import { Package, Radio } from "lucide-react";
import { AdminExtensionTab as AdminExtensionCore } from "./admin-extension-core";
import { AdminLiveTab } from "./admin-live";

export function AdminExtensionTab() {
  const [product, setProduct] = useState<"extension" | "live">("extension");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-background/40 p-2">
        <button
          type="button"
          onClick={() => setProduct("extension")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition ${
            product === "extension"
              ? "bg-primary/15 text-primary shadow-sm"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" /> Extensão principal
        </button>
        <button
          type="button"
          onClick={() => setProduct("live")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition ${
            product === "live"
              ? "bg-fuchsia-500/15 text-fuchsia-200 shadow-sm"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <Radio className="h-4 w-4" /> MSK LIVE · Licenças
        </button>
      </div>

      {product === "extension" ? <AdminExtensionCore /> : <AdminLiveTab />}
    </div>
  );
}
