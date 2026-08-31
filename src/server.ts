import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

const MSK_APPROVED_BUILDS = [
  "3.4.49=0e6a4f54b0529b0a7a418821ad52082d5a4e78bbc35aa9d3ac8de9d2e3ba48a9",
  "3.4.49=96217c9c41c9022bb6624aa91836ea28e6f16c0568b875d71f489c42c4c6e278",
  "3.4.49=25ac5d5d3ea5a4670698c381d81047e7e19248efaf813deb06df07a048406fb4",
  "3.4.49=91a0bfc3aa2dbc1547da0fbf14dfcb724019b8229b972e87ddee86ec1bd4c0af",
  "3.4.49=4e33986364c2eee30d1baa0f1e1079212a34b1a8576f45371313a87110dc1996",
  "3.4.49=e0379fe1f2f403b41da52302b9c9bad85744e3596699a0de6d5a2c9dce49d4fb",
  "3.4.49=a98175aa85a42a8537315a5f23dfc11516cb194c2f052eff171cb5734347efdd",
  "3.4.49=f38a08f95babd79a3964666d928d66c4643cdaed381bcc84594f353652982074",
];
const approvedBuilds = String(process.env["MSK_EXTENSION_APPROVED_INTEGRITY_ROOTS"] ?? "");
const approvedSet = new Set(approvedBuilds.split(",").map((item) => item.trim()).filter(Boolean));
for (const build of MSK_APPROVED_BUILDS) approvedSet.add(build);
process.env["MSK_EXTENSION_APPROVED_INTEGRITY_ROOTS"] = [...approvedSet].join(",");

const MSK_APPROVED_FINGERPRINTS = [
  "f3f7a8c085b19b8d3ce62dd7f3d4444367d7d4fce5a49babd7810e69a2b49629",
];
const configuredFingerprints = String(process.env["MSK_EXTENSION_APPROVED_FINGERPRINTS"] ?? "");
const fingerprintSet = new Set(configuredFingerprints.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
for (const fingerprint of MSK_APPROVED_FINGERPRINTS) fingerprintSet.add(fingerprint);
process.env["MSK_EXTENSION_APPROVED_FINGERPRINTS"] = [...fingerprintSet].join(",");

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
