import type { NextConfig } from 'next'

const securityHeaders = [
  // Prevent clickjacking — only allow same origin to embed this site
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control referrer information
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // DNS prefetch
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Force HTTPS
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https://www.googleapis.com https://accounts.google.com https://*.public.blob.vercel-storage.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
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
