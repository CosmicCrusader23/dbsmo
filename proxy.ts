import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { canAccessAdminArea } from "@/lib/permissions";

export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/admin") && !canAccessAdminArea(role)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("notice", "admin-required");
      return NextResponse.redirect(url);
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: ["/admin/:path*", "/dashboard", "/dashboard/:path*", "/problem-sets/:path*"],
};
