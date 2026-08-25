/**
 * Shopify pages (multi-tenant) — resolves the store from the [store]
 * slug; the body lives in lib/pages/shopify-page.tsx.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import {ShopifyPage, shopifyPageMetadata} from '~/lib/pages/shopify-page';

type Params = Promise<{store: string; handle: string}>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const {store, handle} = await params;
  return shopifyPageMetadata(requireStore(store), handle);
}

export default async function Page({params}: {params: Params}) {
  const {store, handle} = await params;
  return <ShopifyPage store={requireStore(store)} handle={handle} />;
}
