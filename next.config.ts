import type { NextConfig } from 'next'

const securityHeaders = [
  // Prevent clickjacking — only allow same origin to embed this site
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Enable XSS protection in older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Control referrer information
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // DNS prefetch
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  // Enable gzip/brotli compression for all responses
  compress: true,

  // Optimise images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  async headers() {
    return [
      // Security headers on all routes
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // Long-lived cache for static assets (JS/CSS bundles have content hashes)
      {
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Cache public images/icons for 7 days
      {
        source: '/(.*)\\.(svg|png|jpg|jpeg|ico|webp|avif)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      // No cache for API routes — always fresh
      {
        source: '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
