import { createBrowserClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const encodedName = encodeURIComponent(name);
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split("=");
    if (rawName === encodedName) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function setCookie(name: string, value: string, options?: CookieOptions) {
  if (typeof document === "undefined") return;
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  if (options?.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`Path=${options?.path ?? "/"}`);
  if (options?.domain) parts.push(`Domain=${options.domain}`);
  if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options?.secure) parts.push("Secure");

  document.cookie = parts.join("; ");
}

function removeCookie(name: string, options?: CookieOptions) {
  setCookie(name, "", { ...options, maxAge: 0 });
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, key, {
      cookies: {
        get(name) {
          return getCookie(name);
        },
        set(name, value, options) {
          setCookie(name, value, options);
        },
        remove(name, options) {
          removeCookie(name, options);
        }
      }
    });
  }

  return browserClient;
}
