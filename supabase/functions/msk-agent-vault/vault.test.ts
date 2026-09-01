import "jsr:@std/assert";
import { assertEquals } from "jsr:@std/assert";

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), c => c.charCodeAt(0));

async function key(master: string) {
  const material = await crypto.subtle.digest("SHA-256", enc.encode(`msk-credential-vault:v1:${master}`));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(master: string, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(master), enc.encode(value));
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(cipher))}`;
}
async function decrypt(master: string, value: string) {
  const [, iv, cipher] = value.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv) }, await key(master), fromB64url(cipher));
  return dec.decode(plain);
}
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function isCredentialIntent(command: string) {
  const text = normalize(command);
  const credentialWord = /\b(credencial|credenciais|api[ _-]?key|chave[ _-]?(publica|secreta|api)|secret|segredo|client[ _-]?id|client[ _-]?secret|access[ _-]?token|token de api)\b/.test(text);
  const changeVerb = /\b(troqu|troc|mud|alter|atualiz|configur|adicion|substitu|cadastr|salv)/.test(text);
  return credentialWord && changeVerb;
}

Deno.test("credential vault AES-GCM roundtrip", async () => {
  const master = "test-master-key-that-never-leaves-test";
  const secret = "sk_test_example_123456789";
  const cipher = await encrypt(master, secret);
  assertEquals(cipher.startsWith("v1."), true);
  assertEquals(cipher.includes(secret), false);
  assertEquals(await decrypt(master, cipher), secret);
});

Deno.test("credential intent recognizes real credential change", () => {
  assertEquals(isCredentialIntent("troque as credenciais da SigiloPay"), true);
  assertEquals(isCredentialIntent("mude a chave secreta da API"), true);
});

Deno.test("credential intent does not hijack visual Pix edits", () => {
  assertEquals(isCredentialIntent("mude o texto Pix confirmado automaticamente para branco"), false);
  assertEquals(isCredentialIntent("troque a cor do botão de pagamento"), false);
});