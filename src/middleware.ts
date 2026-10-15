import { NextResponse, type NextRequest } from "next/server";

// Cheap edge gate: without a session cookie, protected areas go straight to login.
// Real validation (session, membership, role, entitlements) happens on the server for every request.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("ap_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin/:path*", "/select-org"] };
