/**
 * /search (multi-tenant) — resolves the store from the [store] slug;
 * the body lives in lib/pages/search.tsx.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import {SearchPage} from '~/lib/pages/search';
import type {RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{store: string}>;
type SearchParams = Promise<RawSearchParams>;

export const metadata: Metadata = {title: 'Search'};

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <SearchPage
      store={requireStore((await params).store)}
      searchParams={await searchParams}
    />
  );
}
