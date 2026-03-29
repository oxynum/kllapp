import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { locales, defaultLocale, type Locale } from "@/i18n/config";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (works on single-instance deploys like Railway)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Periodic cleanup to prevent memory leaks (every 1000 checks)
let cleanupCounter = 0;
function maybeCleanup() {
  cleanupCounter++;
  if (cleanupCounter < 1000) return;
  cleanupCounter = 0;
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}

export default auth(async (req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const publicPaths = ["/login", "/verify", "/api/auth", "/privacy", "/terms"];
  const isPublic = publicPaths.some((path) =>
    nextUrl.pathname.startsWith(path)
  );
  const isOnboarding = nextUrl.pathname.startsWith("/onboarding");

  // Rate limit auth POST endpoints to prevent brute-force (login, register, etc.)
  // GET requests (/api/auth/session, /api/auth/csrf) are excluded — they are
  // frequent session checks and must not be throttled.
  if (req.method === "POST" && nextUrl.pathname.startsWith("/api/auth")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    maybeCleanup();
    // Try Redis first (dynamic import to avoid loading ioredis in proxy runtime), fallback to in-memory
    let redisLimited = false;
    if (process.env.REDIS_URL) {
      const { isRateLimitedRedis } = await import("@/lib/redis");
      redisLimited = await isRateLimitedRedis(ip);
    }
    if (redisLimited || isRateLimited(ip)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  }

  if (!isPublic && !isOnboarding && !isLoggedIn) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  // Redirect to onboarding if logged in but no organization
  if (isLoggedIn && !isPublic && !isOnboarding) {
    const hasOrg = !!session.user?.currentOrganizationId;
    if (!hasOrg) {
      return Response.redirect(new URL("/onboarding", nextUrl));
    }
  }

  // Redirect away from onboarding if already has an org
  if (isLoggedIn && isOnboarding) {
    const hasOrg = !!session.user?.currentOrganizationId;
    if (hasOrg) {
      return Response.redirect(new URL("/", nextUrl));
    }
  }

  // ---------------------------------------------------------------------------
  // Locale detection: JWT > cookie > Accept-Language > default
  // ---------------------------------------------------------------------------
  let locale: Locale = defaultLocale;

  const jwtLocale = session?.user?.locale;
  if (jwtLocale && locales.includes(jwtLocale as Locale)) {
    locale = jwtLocale as Locale;
  } else {
    const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value;
    if (cookieLocale && locales.includes(cookieLocale as Locale)) {
      locale = cookieLocale as Locale;
    } else {
      const acceptLang = req.headers.get("Accept-Language");
      if (acceptLang) {
        const preferred = acceptLang
          .split(",")
          .map((part) => {
            const [lang, q] = part.trim().split(";q=");
            return { lang: lang.trim().split("-")[0], q: q ? parseFloat(q) : 1 };
          })
          .sort((a, b) => b.q - a.q);
        for (const { lang } of preferred) {
          if (locales.includes(lang as Locale)) {
            locale = lang as Locale;
            break;
          }
        }
      }
    }
  }

  const currentCookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (currentCookie !== locale) {
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
