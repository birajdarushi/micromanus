import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { sendWelcomeEmail, sendAdminSignupNotify } from "@/lib/mail";

export const runtime = "nodejs";

function appOrigin(req: NextRequest, fallback: string) {
  // Heroku / proxies: prefer the public host over the internal one.
  const forwarded = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (forwarded) return `${proto}://${forwarded}`;
  return fallback;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const { searchParams } = url;
  const origin = appOrigin(req, url.origin);

  // Provider may bounce back with ?error=… (e.g. access_denied, bad redirect)
  const oauthError = searchParams.get("error");
  const oauthDesc = searchParams.get("error_description");
  if (oauthError) {
    console.error("[auth/callback] provider error:", oauthError, oauthDesc);
    const msg = encodeURIComponent(oauthDesc || oauthError);
    return NextResponse.redirect(`${origin}/login?error=oauth&message=${msg}`);
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchange failed:", error.message);
      const msg = encodeURIComponent(error.message);
      return NextResponse.redirect(`${origin}/login?error=auth&message=${msg}`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Fire-and-forget welcome + admin notify for brand-new accounts.
      const createdMs = user.created_at ? new Date(user.created_at).getTime() : 0;
      const isNew = createdMs > 0 && Date.now() - createdMs < 15 * 60 * 1000;
      if (isNew && user.email) {
        const name =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          null;
        void Promise.allSettled([
          sendWelcomeEmail(user.email, name),
          sendAdminSignupNotify(user.email),
        ]);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("paywall_passed")
        .eq("id", user.id)
        .single();
      return NextResponse.redirect(
        `${origin}${profile?.paywall_passed ? "/chat" : "/paywall"}`
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth&message=${encodeURIComponent("Missing auth code")}`);
}
