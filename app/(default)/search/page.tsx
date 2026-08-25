/**
 * /search (single-tenant) — thin wrapper binding the env-configured
 * store; the body lives in lib/pages/search.tsx.
 */
import type {Metadata} from 'next';
import {defaultStoreConfig} from '~/lib/store-config';
import {SearchPage} from '~/lib/pages/search';
import type {RawSearchParams} from '~/lib/pages/product';

type SearchParams = Promise<RawSearchParams>;

export const metadata: Metadata = {title: 'Search'};

export default async function Page({searchParams}: {searchParams: SearchParams}) {
  return <SearchPage store={defaultStoreConfig} searchParams={await searchParams} />;
}
