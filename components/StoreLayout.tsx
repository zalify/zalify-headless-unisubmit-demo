/**
 * Store-scoped layout body — everything that used to live in the root
 * layout except the <html>/<body> shell: header-group / {children} /
 * footer-group / overlay-group inside the theme providers, with the
 * store's globals and cart. Shared by app/(default)/layout.tsx (env
 * store, single-tenant) and app/s/[store]/layout.tsx (registry store).
 *
 * Data model (blocking SSR — no Cache Components):
 * - Globals (shop, header/footer menus) come from a per-store
 *   storeCache function tagged 'menus' + 'menus:<slug>' (hourly
 *   revalidate), so they don't hit the API per request.
 * - The cart reads the store's httpOnly cookie (runtime data): the
 *   layout passes getCart()'s *promise* into the client CartProvider,
 *   which bootstraps the optimistic cart store with it after
 *   hydration (components/cart/cart-context.tsx) — the cart never
 *   blocks page rendering, and from then on every mutation posts to
 *   /api/cart and reconciles client-side.
 */
import type {ReactNode} from 'react';
import {getStorefront} from '~/lib/storefront';
import {publicDomainOf, type StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import {getCart} from '~/lib/cart';
import {getPixelWorkspaceId} from '~/lib/pixel-server';
import SectionGroupClient from '~/components/SectionGroupClient';
import PredictiveSearchSection from '~/components/sections/predictive-search';
import {QuickAddDialog} from '~/components/theme/QuickAddDialog';
import {PixelEvents} from '~/components/theme/PixelEvents';
import {
  fontSettingsFromSchema,
  googleFontsHrefsFromSettings,
  resolveGoogleFontCss,
} from '@zalify/storefront-kit/commerce';
import {getSettingsOverride, getThemeSchema} from '~/lib/store-theme-data';
import {Providers, type ThemeGlobalsProps} from '~/app/providers';

/** Out-of-the-box nav when the store has no main-menu (e.g. mock.shop). */
const FALLBACK_MENU = {
  items: [
    {id: 'fallback-home', title: 'Home', url: '/'},
    {id: 'fallback-shop', title: 'Shop', url: '/collections/all'},
    {id: 'fallback-collections', title: 'Collections', url: '/collections'},
  ],
};

const loadGlobals = storeCache('globals', loadGlobalsUncached, {
  revalidate: 3600,
  tags: ['menus'],
});

async function loadGlobalsUncached(
  store: StoreConfig,
): Promise<ThemeGlobalsProps> {
  const storefront = getStorefront(store);
  const [header, footer] = await Promise.all([
    storefront
      .query(HEADER_QUERY, {variables: {headerMenuHandle: 'main-menu'}})
      .catch((error: unknown) => {
        console.error('[layout] header query failed', error);
        return null;
      }),
    storefront
      .query(FOOTER_QUERY, {variables: {footerMenuHandle: 'footer'}})
      .catch((error: unknown) => {
        console.error('[layout] footer query failed', error);
        return null;
      }),
  ]);

  return {
    header: {
      shop: header?.shop ?? {name: store.name ?? 'Zalify'},
      menu: header?.menu ?? FALLBACK_MENU,
    },
    footer: {
      menu: footer?.menu ?? null,
      secondaryMenu: footer?.secondaryMenu ?? null,
    },
    publicStoreDomain: publicDomainOf(store),
  };
}

export default async function StoreLayout({
  store,
  children,
}: {
  store: StoreConfig;
  children: ReactNode;
}) {
  const globals = await loadGlobals(store);
  // Inline @font-face + woff2 preloads (next/font pattern) — resolved
  // per store schema (stores/<slug>/theme/ may pick different fonts)
  // and cached per URL set; null falls back to the async loader.
  const fonts = await resolveGoogleFontCss(
    googleFontsHrefsFromSettings(
      fontSettingsFromSchema(
        getThemeSchema(store.slug),
        getSettingsOverride(store.slug),
      ),
    ),
  );
  // Deliberately NOT awaited: the promise streams into the client cart
  // store's bootstrap, keeping cookie access out of the static shell.
  const cartPromise = getCart(store);

  // Zalify Pixel — canonical embed (queue stub + deferred loader),
  // server-rendered so the stub exists before hydration; no pixel.json
  // → no tags. See lib/pixel.ts.
  const pixelWid = getPixelWorkspaceId();

  return (
    <Providers
      globals={globals}
      cartPromise={cartPromise}
      fonts={fonts}
      themeSlug={store.slug}
    >
      <SectionGroupClient name="header-group" />
      <main id="MainContent">{children}</main>
      <SectionGroupClient name="footer-group" />
      <SectionGroupClient name="overlay-group" />
      {/* Overlay singletons mounted once per page, mirroring the
          Hydrogen PageLayout: the search drawer (opened by the
          header's data-dialog-open="SearchDrawer" trigger) and the
          quick-add dialog (opened by ProductCard's 'quick-add:open'
          event; a successful add opens the cart drawer above). */}
      <PredictiveSearchSection />
      <QuickAddDialog />
      {pixelWid ? <PixelEvents /> : null}
      {pixelWid ? (
        <>
          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: static queue stub
            dangerouslySetInnerHTML={{
              __html:
                'window.zalify=window.zalify||function(){(zalify.q=zalify.q||[]).push(arguments)};',
            }}
          />
          <script
            src={`https://cdn.zalify.com/pixel.js?wid=${encodeURIComponent(pixelWid)}`}
            defer
          />
        </>
      ) : null}
    </Providers>
  );
}
