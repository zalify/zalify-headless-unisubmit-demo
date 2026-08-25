/**
 * Product page (multi-tenant) — resolves the store from the [store]
 * slug; the body lives in lib/pages/product.tsx.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import {ProductPage, productMetadata, type RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{store: string; handle: string}>;
type SearchParams = Promise<RawSearchParams>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const {store, handle} = await params;
  return productMetadata(requireStore(store), handle);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const {store, handle} = await params;
  return (
    <ProductPage
      store={requireStore(store)}
      handle={handle}
      searchParams={await searchParams}
    />
  );
}
