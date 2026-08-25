import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* Deliberately NOT using Cache Components: that model requires every
     runtime-data page to stream through a <Suspense> hole (skeleton →
     content swap), and this template prefers classic blocking SSR —
     navigation stays on the previous page until the next one is fully
     rendered. Data caching happens per-fetch via unstable_cache
     (see README "How caching works"). */
  /* @zalify/storefront-kit/react and @zalify/storefront-kit/commerce ship TypeScript source
     (consumed as source by every storefront app) — Next must compile
     them as part of this app's build. @zalify/storefront-kit/react is an *injected*
     workspace dependency (package.json dependenciesMeta): pnpm hard-
     links a per-app copy with its `react >=18` peer resolved to this
     app's React 19 — the plain symlink would see the Hydrogen app's
     React 18 (packages/ui-react/node_modules/react), and bundling that
     second jsx-runtime crashes hydration (`ReactCurrentOwner` of
     undefined). */
  transpilePackages: ['@zalify/storefront-kit/react', '@zalify/storefront-kit/commerce'],
  images: {
    remotePatterns: [
      // Shopify product/collection media
      {protocol: 'https', hostname: 'cdn.shopify.com'},
      // Zalify asset library — merchandising imagery (hero/banner masters)
      // referenced by URL from theme templates
      {protocol: 'https', hostname: 'z1assets.zalify.com'},
    ],
  },
};

export default nextConfig;
