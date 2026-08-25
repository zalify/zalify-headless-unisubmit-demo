/**
 * /collections (multi-tenant) — resolves the store from the [store]
 * slug; the body lives in lib/pages/collections-index.tsx.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import {CollectionsIndexPage} from '~/lib/pages/collections-index';
import type {RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{store: string}>;
type SearchParams = Promise<RawSearchParams>;

export const metadata: Metadata = {title: 'Collections'};

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <CollectionsIndexPage
      store={requireStore((await params).store)}
      searchParams={await searchParams}
    />
  );
}
