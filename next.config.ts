import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // pdfkit uses __dirname to locate its bundled .afm font metric files and the
  // ICC color profile. When Turbopack/webpack bundles pdfkit, __dirname resolves
  // to a synthetic "/ROOT" path that doesn't exist at runtime. Marking it as a
  // server external package preserves the real __dirname so the data files are
  // resolved from node_modules/pdfkit/js/data/.
  // @prisma/client is also marked external so Turbopack does not pre-bundle it —
  // this lets the runtime pick up freshly-regenerated clients without a full
  // server restart after `prisma generate`.
  serverExternalPackages: ["pdfkit", "@prisma/client"],
};

export default nextConfig;
