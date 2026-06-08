/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // pdfkit lit ses fichiers de polices (.afm) au runtime via __dirname — le marquer comme
  // "external" empêche webpack de le bundler (ce qui casserait cette résolution de chemin)
  // et permet au traçage de fichiers de Next de copier le module dans .next/standalone.
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
}

module.exports = nextConfig
