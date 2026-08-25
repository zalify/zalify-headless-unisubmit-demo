/**
 * Shopify pages (single-tenant) — thin wrapper binding the
 * env-configured store; the body lives in lib/pages/shopify-page.tsx.
 */
import type {Metadata} from 'next';
import {defaultStoreConfig} from '~/lib/store-config';
import {ShopifyPage, shopifyPageMetadata} from '~/lib/pages/shopify-page';

type Params = Promise<{handle: string}>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  return shopifyPageMetadata(defaultStoreConfig, (await params).handle);
}

export default async function Page({params}: {params: Params}) {
  return <ShopifyPage store={defaultStoreConfig} handle={(await params).handle} />;
}
