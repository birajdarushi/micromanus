import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { sendWelcomeEmail, sendAdminSignupNotify } from "@/lib/mail";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Fire-and-forget welcome + admin notify for brand-new accounts.
        // Window: created within the last 15 minutes (covers OAuth redirect lag).
        // Skipped when Gmail env is unset.
        const createdMs = user.created_at ? new Date(user.created_at).getTime() : 0;
        const isNew = createdMs > 0 && Date.now() - createdMs < 15 * 60 * 1000;
        if (isNew && user.email) {
          const name =
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            null;
          // do not await — OAuth redirect must stay snappy
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
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
