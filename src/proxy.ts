import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie and guards app routes.
export default async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // OAuth sometimes lands on Site URL root with ?code=… (not /auth/callback).
  // Forward that to the real exchange handler so login isn't dropped.
  if (
    searchParams.has("code") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/api")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Discord / WhatsApp webhooks must answer within ~3s. Skip Supabase session
  // refresh entirely — they use their own signatures, not cookies.
  if (
    pathname.startsWith("/api/surfaces/") ||
    pathname.startsWith("/api/v1/")
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    pathname === "/login" || pathname.startsWith("/auth") || pathname === "/favicon.ico";

  if (!user && !isPublic && !pathname.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
