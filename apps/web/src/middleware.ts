import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// /api/v1 is proxied to FastAPI, which checks the token itself.
const isPublic = createRouteMatcher(["/sign-in(.*)", "/welcome", "/api/v1(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    if (isPublic(req)) return;
    const { userId } = await auth();
    // Strangers get the landing page, not a bare sign-in box.
    if (!userId) return NextResponse.redirect(new URL("/welcome", req.url));
  },
  { signInUrl: "/sign-in" },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
