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
  `connect-src 'self' ws: wss:${supabaseConnectOrigin ? ` ${supabaseConnectOrigin}` : ""}`,
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.119"],
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
    ];
  },
};

export default nextConfig;
