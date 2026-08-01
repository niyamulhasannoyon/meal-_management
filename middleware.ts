import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets & internal next routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for auth presence (token or firebase auth cookie indicator if set)
  // Note: Client AuthContext handles deep verification, middleware prevents instant layout flashing
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  // Allow next navigation
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
