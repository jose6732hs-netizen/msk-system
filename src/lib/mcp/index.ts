import { defineMcp } from "@lovable.dev/mcp-js";
import getMyAccount from "./tools/get-my-account";
import listMyLicenses from "./tools/list-my-licenses";
import getMyTokenBalance from "./tools/get-my-token-balance";
import listPlans from "./tools/list-plans";
import { auth } from "@lovable.dev/mcp-js";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "zjrrymncmiyftyogejjr";

export default defineMcp({
  name: "msk-sistem",
  title: "MSK SISTEM",
  version: "1.0.0",
  instructions: "Tools for managing MSK SISTEM account, licenses, tokens, and plans. Callers can view their active licenses, token balances, and available purchase plans.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyAccount, listMyLicenses, getMyTokenBalance, listPlans],
});
