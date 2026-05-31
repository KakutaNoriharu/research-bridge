export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/search/:path*",
    "/matches/:path*",
    "/messages/:path*",
    "/interests/:path*",
    "/users/:path*",
  ],
};
