import type { NextConfig } from "next";
import { resolveApiBaseUrl } from "./src/lib/api-config";
import { validateSupabasePublicConfig } from "./src/lib/supabase/config";

if (process.env.NODE_ENV === "production") {
  resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "", "production");
  validateSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
  });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
