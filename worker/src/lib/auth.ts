import { sanitizeText } from "./sanitize";
import type { AuthenticatedUser } from "../types";

const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let cachedJwks: { keys: any[]; expiresAt: number } | null = null;

export function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function decodeJwtPart(part: string): any {
  const bytes = base64UrlToUint8Array(part);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function getGoogleJwks(): Promise<any[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) {
    throw new Error("No se pudieron obtener las claves públicas de Google");
  }
  const data: any = await res.json();
  cachedJwks = {
    keys: data.keys || [],
    expiresAt: now + 1000 * 60 * 60, // 1 hora en caché
  };
  return cachedJwks.keys;
}

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
): Promise<AuthenticatedUser | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodeJwtPart(headerB64);
    const payload = decodeJwtPart(payloadB64);

    if (header.alg !== "RS256" || !header.kid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      return null;
    }
    if (!payload.sub || typeof payload.sub !== "string") return null;

    const keys = await getGoogleJwks();
    const jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signature,
      signedData,
    );

    if (!isValid) return null;

    const rawName =
      payload.name ||
      (typeof payload.email === "string"
        ? payload.email.split("@")[0]
        : "Usuario");
    const displayName = sanitizeText(rawName, 50) || "Usuario";

    return { userId: payload.sub, displayName };
  } catch {
    return null;
  }
}

