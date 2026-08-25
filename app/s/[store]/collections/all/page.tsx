/**
 * /collections/all (multi-tenant) — resolves the store from the [store]
 * slug; the body lives in lib/pages/catalog.tsx.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import {CatalogPage} from '~/lib/pages/catalog';
import type {RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{store: string}>;
type SearchParams = Promise<RawSearchParams>;

export const metadata: Metadata = {title: 'Products'};

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <CatalogPage
      store={requireStore((await params).store)}
      searchParams={await searchParams}
    />
  );
}
