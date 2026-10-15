export const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

export type HasilOpenAI<T> = { ok: true; data: T; model: string } | { ok: false; error: string; status: number };

/** Panggil OpenAI Chat Completions dengan structured output (json_schema strict). Hanya untuk route server. */
export async function callStructured<T>(opts: {
  system: string; user: string; name: string; schema: object; effort?: "low" | "medium" | "high";
}): Promise<HasilOpenAI<T>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "OPENAI_API_KEY belum diisi di .env.local.", status: 500 };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: opts.effort ?? "medium",
      messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }],
      response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema } },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: `OpenAI: ${body?.error?.message ?? res.statusText}`, status: 502 };
  const msg = body?.choices?.[0]?.message;
  if (msg?.refusal) return { ok: false, error: `Model menolak: ${msg.refusal}`, status: 502 };
  try {
    return { ok: true, data: JSON.parse(msg?.content ?? "") as T, model: body.model ?? MODEL };
  } catch {
    return { ok: false, error: "Respons model tidak dapat dibaca. Coba lagi.", status: 502 };
  }
}
