import type { NextConfig } from "next";

const basePath = "/splitcuenta"; // nombre del repo en GitHub

const nextConfig: NextConfig = {
  output: "export",      // genera sitio estático en /out
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: {
    unoptimized: true,   // requerido para export estático
  },
};

export default nextConfig;
