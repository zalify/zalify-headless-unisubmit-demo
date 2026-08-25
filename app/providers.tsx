'use client';
/**
 * Client boundary at the top of the tree: installs the theme (side
 * effect import), injects the Next.js adapter, publishes the Liquid
 * globals mirror (menus, shop) resolved by the server layout, mounts
 * the optimistic cart store (bootstrapped from a *promise* streamed
 * by the layout — see components/cart/cart-context.tsx), and emits
 * the merchant design tokens (<CssVariables/>) once.
 */
import {installThemeForStore} from '~/lib/theme-setup';
import type {ReactNode} from 'react';
import {AdapterProvider, CssVariables, ThemeDataProvider} from '@zalify/storefront-kit/react';
import type {ResolvedGoogleFontCss} from '@zalify/storefront-kit/commerce';
import {nextAdapter} from '~/lib/theme-adapter';
import {CartProvider} from '~/components/cart/cart-context';
import type {CartData} from '~/lib/cart';

export interface ThemeGlobalsProps {
  /** HEADER_QUERY result: {shop, menu}. */
  header: unknown;
  /** FOOTER_QUERY result: {menu}. */
  footer: unknown;
  publicStoreDomain: string;
}

export function Providers({
  globals,
  cartPromise,
  fonts,
  themeSlug,
  children,
}: {
  globals: ThemeGlobalsProps;
  cartPromise: Promise<CartData | null>;
  fonts?: ResolvedGoogleFontCss | null;
  /** Store slug whose theme data (settings/templates/locales) to install. */
  themeSlug?: string;
  children: ReactNode;
}) {
  // Swap the engine store to this tenant's theme data before anything
  // below (CssVariables, sections) reads it. Idempotent per slug.
  installThemeForStore(themeSlug);
  return (
    <AdapterProvider adapter={nextAdapter}>
      <ThemeDataProvider value={{...globals}}>
        <CartProvider cartPromise={cartPromise}>
          <CssVariables fonts={fonts} />
          {children}
        </CartProvider>
      </ThemeDataProvider>
    </AdapterProvider>
  );
}
