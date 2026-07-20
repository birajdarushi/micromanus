import { NextRequest } from "next/server";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { MODELS } from "@/lib/models";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: cfg } = await supabase
    .from("api_configs")
    .select("base_url, default_model, api_key_encrypted, updated_at")
    .eq("user_id", user.id)
    .single();

  let keyPreview: string | null = null;
  if (cfg?.api_key_encrypted) {
    try {
      const key = decryptSecret(cfg.api_key_encrypted);
      keyPreview = key.length > 8 ? `${key.slice(0, 5)}…${key.slice(-4)}` : "•••";
    } catch {
      keyPreview = "•••";
    }
  }

  return Response.json({
    config: cfg
      ? { baseUrl: cfg.base_url, defaultModel: cfg.default_model, keyPreview }
      : null,
    models: MODELS,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  // Normalize the base URL: the OpenAI client appends "/chat/completions" itself,
  // so strip it if the user pasted the full endpoint (a very common mistake).
  const baseUrl: string = (body?.baseUrl ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/, "")
    .replace(/\/+$/, "");
  const apiKey: string = (body?.apiKey ?? "").trim();
  const defaultModel: string = (body?.defaultModel ?? "").trim();

  if (!baseUrl || !defaultModel) {
    return Response.json({ error: "Base URL and model are required" }, { status: 400 });
  }
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    return Response.json({ error: "Invalid base URL" }, { status: 400 });
  }

  // An API key goes into an HTTP Authorization header, which only permits
  // printable ASCII. Reject anything with spaces/newlines/non-ASCII up front —
  // otherwise it saves fine but crashes the agent later with a cryptic
  // "Cannot convert argument to a ByteString" error. This also catches the
  // common mistake of pasting a prompt into the API key field.
  if (apiKey && !/^[\x21-\x7E]+$/.test(apiKey)) {
    return Response.json(
      {
        error:
          "That doesn't look like an API key — it contains spaces or non-ASCII characters. Paste your provider key (e.g. sk-…), not a prompt or other text.",
      },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();

  // if no new key was provided, keep the existing one
  let encrypted: string | null = null;
  if (apiKey) {
    encrypted = encryptSecret(apiKey);
  } else {
    const { data: existing } = await admin
      .from("api_configs")
      .select("api_key_encrypted")
      .eq("user_id", user.id)
      .single();
    encrypted = existing?.api_key_encrypted ?? null;
  }
  if (!encrypted) {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  // soft validation: one tiny completion against the endpoint (non-fatal if the
  // provider rejects the probe for a non-auth reason)
  if (apiKey) {
    try {
      const client = new OpenAI({ apiKey, baseURL: baseUrl, timeout: 20_000, maxRetries: 0 });
      await client.chat.completions.create({
        model: defaultModel,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        return Response.json(
          { error: "The API key was rejected by the provider (401/403). Check the key and base URL." },
          { status: 400 }
        );
      }
      // other errors (model naming quirks, max_tokens param differences) — accept the key
    }
  }

  const { error } = await admin.from("api_configs").upsert({
    user_id: user.id,
    base_url: baseUrl,
    api_key_encrypted: encrypted,
    default_model: defaultModel,
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
