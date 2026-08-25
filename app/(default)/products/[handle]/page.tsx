/**
 * Product page (single-tenant) — thin wrapper binding the
 * env-configured store; the body lives in lib/pages/product.tsx.
 */
import type {Metadata} from 'next';
import {defaultStoreConfig} from '~/lib/store-config';
import {ProductPage, productMetadata, type RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{handle: string}>;
type SearchParams = Promise<RawSearchParams>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  return productMetadata(defaultStoreConfig, (await params).handle);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <ProductPage
      store={defaultStoreConfig}
      handle={(await params).handle}
      searchParams={await searchParams}
    />
  );
}
