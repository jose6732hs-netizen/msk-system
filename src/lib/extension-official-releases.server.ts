export type OfficialExtensionRelease = Readonly<{
  version: string;
  channel: "stable" | "beta";
  integrityDigest: string;
  zipSha256: string;
  bridgeVersion: number;
  title: string;
}>;

/**
 * Builds oficiais reconhecidos pelo backend MSK.
 *
 * O digest abaixo é o SHA-256 da política de integridade embutida no pacote,
 * calculado exatamente como o service worker da extensão calcula em runtime.
 * Não contém token, licença ou segredo.
 */
export const OFFICIAL_EXTENSION_RELEASES: Readonly<Record<string, OfficialExtensionRelease>> = Object.freeze({
  "4.4.0": Object.freeze({
    version: "4.4.0",
    channel: "stable",
    integrityDigest: "2dab840879ba88028f33229f954b9a6a1430ae14c574d7ecacc66d0db43b4d1b",
    zipSha256: "d03619bd673882a3ac41d2f46a82fc82001bab53e934a80844884b7547a8d732",
    bridgeVersion: 1,
    title: "MSK Agente v4.4.0 — Cirúrgico + Autocura + CI + Cofre MSK",
  }),
  "4.2.37": Object.freeze({
    version: "4.2.37",
    channel: "stable",
    integrityDigest: "fc9ca740b9bcfdbfd79debb435001dd6d718c4179a3f6beca4e6f21d23363652",
    zipSha256: "fdfe55527358ec9a2b55685d29e69007ff1bba3e671432d8923cc4d8b11c3164",
    bridgeVersion: 1,
    title: "MSK Agente v4.2.37 — Guardião + Painel Profissional",
  }),
});

export function getOfficialExtensionRelease(version: string | null | undefined) {
  const normalized = String(version ?? "").trim();
  return OFFICIAL_EXTENSION_RELEASES[normalized] ?? null;
}

export function verifyOfficialExtensionDigest(
  version: string | null | undefined,
  digest: string | null | undefined,
) {
  const release = getOfficialExtensionRelease(version);
  if (!release) return { official: false as const, reason: "VERSION_NOT_REGISTERED" as const, release: null };
  const normalized = String(digest ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    return { official: false as const, reason: "DIGEST_MISSING" as const, release };
  }
  if (normalized !== release.integrityDigest) {
    return { official: false as const, reason: "DIGEST_MISMATCH" as const, release };
  }
  return { official: true as const, reason: null, release };
}
