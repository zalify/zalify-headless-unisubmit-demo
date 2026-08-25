/**
 * installTheme() for the client-module graph: the sync-generated schema
 * plus the explicit component registries (Next has no import.meta.glob
 * — every app-local section/block is registered by hand here).
 *
 * Imported for its side effect at the top of every client entry that
 * renders theme components (app/providers.tsx, the ThemeTemplate/
 * SectionGroup wrappers), so the store is populated before any render
 * — during SSR of client components and in the browser alike.
 *
 * IMPORTANT: never import this module from server components — the
 * registries pull hook-using components, which the RSC graph rejects.
 * Server code uses lib/theme-server.ts instead (schema lookups +
 * section loaders only).
 */
import {builtinBlocks, builtinSections, installTheme} from '@zalify/storefront-kit/react';
import type {ThemeSchema} from '@zalify/storefront-kit/react';
import {DEFAULT_STORE_SLUG} from './store-config';
import {getSettingsOverride, getThemeSchema} from './store-theme-data';

// App-local sections
import header from '~/components/sections/header';
import footer from '~/components/sections/footer';
import product from '~/components/sections/product';
import productRecommendations from '~/components/sections/product-recommendations';
import collection from '~/components/sections/collection';
import collections from '~/components/sections/collections';
import search from '~/components/sections/search';
import blog from '~/components/sections/blog';
import cart from '~/components/sections/cart';
import cartDrawer from '~/components/sections/cart-drawer';
import quickAdd from '~/components/sections/quick-add';

// App-local blocks (product info column)
import title from '~/components/blocks/_title';
import description from '~/components/blocks/_description';
import buyButtons from '~/components/blocks/_buy-buttons';
import quantity from '~/components/blocks/_quantity';
import sizeGuide from '~/components/blocks/_size-guide';
import variantPicker from '~/components/blocks/_variant-picker';

function install(schema: ThemeSchema, settingsOverride?: Record<string, unknown>) {
  installTheme({
    schema,
    // Shared with the server layout's font resolution — see
    // lib/theme-overrides.ts. Skipped for stores that own their
    // settings_data (lib/store-theme-data.ts).
    settingsOverride,
    sections: {
      ...builtinSections,
      header,
      footer,
      product,
      'product-recommendations': productRecommendations,
      collection,
      collections,
      search,
      blog,
      cart,
      'cart-drawer': cartDrawer,
      // Never placed in a template (the quick-add dialog renders it
      // directly), registered for parity with the Liquid section list.
      'quick-add': quickAdd,
    },
    blocks: {
      ...builtinBlocks,
      _title: title,
      _description: description,
      '_buy-buttons': buyButtons,
      _quantity: quantity,
      '_size-guide': sizeGuide,
      '_variant-picker': variantPicker,
    },
    // Server loaders live in lib/section-loaders.ts and run through
    // lib/theme-server.ts — the client store never calls them.
  });
}

let installedSlug: string | null = null;

/**
 * Install (or swap to) the theme data a store owns. Idempotent per
 * slug: app/providers.tsx calls this during render with the layout's
 * store slug, before any theme component renders below it — in the
 * browser one page is one tenant; during SSR the swap happens at the
 * top of each request's render pass. Stores without overrides resolve
 * to the same default schema object, so the swap is a no-op for them.
 */
export function installThemeForStore(slug: string = DEFAULT_STORE_SLUG): void {
  if (installedSlug === slug) return;
  install(getThemeSchema(slug), getSettingsOverride(slug));
  installedSlug = slug;
}

// Side-effect import contract (ThemeTemplateClient, SectionGroupClient…):
// the default install makes the module-eval order safe; Providers then
// swaps in the tenant's schema before rendering children.
installThemeForStore(DEFAULT_STORE_SLUG);
