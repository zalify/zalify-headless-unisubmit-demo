/**
 * Collection page (single-tenant) — thin wrapper binding the
 * env-configured store; the body lives in lib/pages/collection.tsx.
 */
import type {Metadata} from 'next';
import {defaultStoreConfig} from '~/lib/store-config';
import {CollectionPage, collectionMetadata} from '~/lib/pages/collection';
import type {RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{handle: string}>;
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
  return (
    <CollectionPage
      store={defaultStoreConfig}
      handle={(await params).handle}
      searchParams={await searchParams}
    />
  );
}
