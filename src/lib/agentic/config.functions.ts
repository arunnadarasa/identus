import { createServerFn } from "@tanstack/react-start";

/**
 * Publishable configuration for the agentic demos. The Privy app ID is a public
 * identifier (it ships in every Privy client bundle); nothing secret is exposed
 * here — the AIsa key is only reported as configured or not.
 */
export const getAgenticConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    privyAppId: process.env["PRIVY_APP_ID"] ?? "",
    aisaConfigured: Boolean(process.env["AISA_API_KEY"]),
  };
});
