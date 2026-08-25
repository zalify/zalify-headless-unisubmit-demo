/**
 * POST /api/revalidate?secret=…&tags=products,collections[&store=<slug>]
 *
 * On-demand cache invalidation for the unstable_cache data used across
 * the app (base tags: products, collections, menus, content). Needed
 * because Vercel's Data Cache persists across deployments — without
 * this route, catalog changes in Shopify only appear when the hourly
 * revalidate window expires, even after a redeploy.
 *
 * Multi-tenant: every cache entry carries both the bare tag
 * ('products') and a store-scoped tag ('products:<slug>', where <slug>
 * is a registry slug or 'default' for the env-configured store — see
 * lib/store-cache.ts). Passing &store=<slug> revalidates only that
 * store's entries; omitting it keeps the original contract and flushes
 * every store via the bare tags.
 *
 * Auth: the `secret` query param must match REVALIDATE_SECRET. When the
 * env var is unset the route is disabled (404) so a deployment can't be
 * flushed anonymously. `tags` is optional and defaults to all tags.
 *
 * Callers: scripts/shopify-import.mjs and scripts/shopify-upload-images.mjs
 * in the monorepo ping this after pushing a catalog; a Shopify
 * products/update webhook can target it too.
 */
import {revalidatePath, revalidateTag} from 'next/cache';
import {NextResponse, type NextRequest} from 'next/server';
import {DEFAULT_STORE_SLUG, getStoreBySlug} from '~/lib/store-config';

const ALL_TAGS = ['products', 'collections', 'menus', 'content'] as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({error: 'revalidation disabled'}, {status: 404});
  }
  if (request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({error: 'invalid secret'}, {status: 401});
  }

  const requested = request.nextUrl.searchParams.get('tags');
  const baseTags = requested
    ? ALL_TAGS.filter((t) => requested.split(',').includes(t))
    : [...ALL_TAGS];

  const store = request.nextUrl.searchParams.get('store');
  if (store && store !== DEFAULT_STORE_SLUG && !getStoreBySlug(store)) {
    return NextResponse.json({error: `unknown store "${store}"`}, {status: 400});
  }

  // With a store: only that tenant's scoped tags. Without: the bare
  // tags, which every store's entries also carry (old contract — one
  // call flushes all stores).
  const tags = store ? baseTags.map((t) => `${t}:${store}`) : baseTags;

  for (const tag of tags) revalidateTag(tag, 'max');
  // Also drop the full-route cache so ISR pages re-render immediately
  // instead of serving the cached HTML until their hourly window lapses.
  revalidatePath('/', 'layout');

  return NextResponse.json({
    revalidated: tags,
    ...(store ? {store} : {}),
    now: Date.now(),
  });
}
