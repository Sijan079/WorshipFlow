import type { NextConfig } from "next";

const supabaseConnectOrigin = (() => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    return url.protocol === "https:" || isLocalHttp ? url.origin : "";
  } catch {
    return "";
  }
})();

const cspHeader = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  `connect-src 'self' ws: wss: wss://api.deepgram.com${supabaseConnectOrigin ? ` ${supabaseConnectOrigin}` : ""}`,
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.119"],
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/@napi-rs/canvas*/**/*",
      "node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs",
    ],
  },
  experimental: {
    proxyClientMaxBodySize: "110mb",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
        ],
      },
      {
        // The microphone is allowed on every workspace page, because the policy comes from the page that first
        // loaded: a booth that opened Services first must still be able to start captions.
        source: "/w/:workspaceSlug/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
          },
        ],
      },
      {
        // Everything behind /api is signed-in, private data (people, birthdates, services). Say so on every
        // response, so no browser, proxy or CDN ever stores it and nothing depends on a framework default.
        // The one exception is the public captions feed, which sets its own short caching and carries caption
        // text only; the test in src/lib/api-cache-headers.test.ts fails if any other route does the same.
        source: "/api/:path((?!captions/live/).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
