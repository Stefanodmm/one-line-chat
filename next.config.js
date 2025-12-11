/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Solo usar output: 'export' cuando construyas para producción
  // En desarrollo, comentar esta línea
  // output: 'export',
  images: {
    unoptimized: true
  },
  trailingSlash: true,
}

module.exports = nextConfig
