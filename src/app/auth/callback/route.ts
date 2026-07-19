import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

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
