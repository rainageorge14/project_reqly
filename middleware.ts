import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "reqly_session";

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    "reqly-fallback-secret-key-that-is-at-least-32-chars-long";
  return new TextEncoder().encode(secret);
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      getSecretKey() as unknown as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      base64UrlToUint8Array(signatureB64) as unknown as BufferSource,
      new TextEncoder().encode(dataToVerify) as unknown as BufferSource
    );

    if (!isValid) return false;

    const payloadJson = new TextDecoder().decode(
      base64UrlToUint8Array(payloadB64)
    );
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = token ? await verifyToken(token) : false;

  const isProtectedPath =
    pathname.startsWith("/dashboard") || pathname.startsWith("/projects");
  const isAuthPath =
    pathname === "/login" || pathname === "/signup";

  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/login",
    "/signup",
  ],
};
