/**
 * Collection page (multi-tenant) — resolves the store from the [store]
 * slug; the body lives in lib/pages/collection.tsx.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import {CollectionPage, collectionMetadata} from '~/lib/pages/collection';
import type {RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{store: string; handle: string}>;
type SearchParams = Promise<RawSearchParams>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  return collectionMetadata((await params).handle);
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
    <CollectionPage
      store={requireStore(store)}
      handle={handle}
      searchParams={await searchParams}
    />
  );
}
