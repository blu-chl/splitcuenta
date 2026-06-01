import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",      // genera sitio estático en /out
  basePath: "/splitcuenta", // nombre del repo en GitHub
  images: {
    unoptimized: true,   // requerido para export estático
  },
};

export default nextConfig;
