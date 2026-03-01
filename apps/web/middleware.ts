import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isAuthPath = pathname === "/login" || pathname === "/signup";
  const isProtectedPath =
    pathname.startsWith("/app") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/project");

  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
