import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships .afm font data files that must stay in node_modules (not bundled);
  // sharp has native bindings and must not be bundled either.
  serverExternalPackages: ["pdfkit", "sharp", "nodemailer"],
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
