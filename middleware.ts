/**
 * Multi-tenant host routing (Vercel Platforms pattern).
 *
 * Matches the request Host against the build-time store registry
 * (lib/store-registry.generated.ts, generated from stores/<slug>/store.json)
 * and rewrites matched requests to /s/<slug>/<original-path>. The
 * browser URL never changes — only the internal route does.
 *
 * No match (including an empty registry, i.e. standalone
 * `zalify theme create` scaffolds) falls through to the existing
 * top-level routes, preserving classic single-store env behavior.
 * Localhost / *.vercel.app map to the DEV_STORE env slug when set
 * (see lib/store-config.ts).
 *
 * Hosts listed in REDIRECT_HOSTS (store.json redirectHosts — stores that
 * moved to standalone deployments) 308-redirect to their canonical site
 * before any store matching, path and query preserved.
 *
 * The matcher skips /api (host-resolved in the handlers themselves),
 * /s (already store-scoped), Next internals, and dotted static files.
 */
import {NextResponse, type NextRequest} from 'next/server';
import {matchStoreByHost} from '~/lib/store-config';
import {REDIRECT_HOSTS} from '~/lib/store-registry.generated';

export function middleware(request: NextRequest): NextResponse {
  const host =
    request.headers.get('host')?.toLowerCase().split(':')[0] ?? '';
  const redirectTo = REDIRECT_HOSTS[host];
  if (redirectTo) {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      redirectTo,
    );
    return NextResponse.redirect(target, 308);
  }

  const store = matchStoreByHost(request.headers.get('host'));
  if (!store) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/s/${store.slug}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!api/|s/|_next/|.*\\..*).*)'],
};
