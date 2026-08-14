/**
 * Thin AIsa (api.aisa.one) chat helper used to give the negotiating agents
 * real reasoning. Model ids are BARE — the gateway rejects prefixed ids.
 *
 * Demo-fallback contract: never throw when the key is missing; return null so
 * the caller can fall back to a deterministic script.
 */

const AISA_BASE = "https://api.aisa.one/v1";

export type AisaResult = {
  text: string | null;
  simulated: boolean;
  error: string | null;
};

export async function aisaChat(
  system: string,
  user: string,
  opts: { model?: string; maxTokens?: number } = {},
): Promise<AisaResult> {
  const key = process.env["AISA_API_KEY"];
  if (!key) {
    return { text: null, simulated: true, error: "AISA_API_KEY not configured" };
  }

  try {
    const res = await fetch(`${AISA_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: opts.model ?? "gpt-4o-mini",
        max_tokens: opts.maxTokens ?? 320,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      const hint =
        res.status === 402
          ? "AIsa balance exhausted — top up at console.aisa.one"
          : res.status === 429
            ? "AIsa rate limit — retry shortly"
            : `AIsa ${res.status}: ${body}`;
      return { text: null, simulated: true, error: hint };
    }

    const json: any = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return { text: null, simulated: true, error: "AIsa returned no content" };
    }
    return { text: text.trim(), simulated: false, error: null };
  } catch (err) {
    return {
      text: null,
      simulated: true,
      error: err instanceof Error ? err.message : "AIsa request failed",
    };
  }
}

/** Ask AIsa for one short JSON object; falls back to null on any problem. */
export async function aisaJson<T>(
  system: string,
  user: string,
  opts: { model?: string } = {},
): Promise<{ value: T | null; simulated: boolean; error: string | null; raw: string | null }> {
  const result = await aisaChat(
    `${system}\n\nReply with a single JSON object and nothing else. No markdown fences.`,
    user,
    opts,
  );
  if (!result.text) {
    return { value: null, simulated: result.simulated, error: result.error, raw: null };
  }
  const cleaned = result.text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return { value: JSON.parse(cleaned) as T, simulated: false, error: null, raw: result.text };
  } catch {
    return {
      value: null,
      simulated: true,
      error: "AIsa reply was not valid JSON",
      raw: result.text,
    };
  }
}
