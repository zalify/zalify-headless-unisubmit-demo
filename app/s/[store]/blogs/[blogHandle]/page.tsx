/**
 * Blog index (multi-tenant) — resolves the store from the [store] slug;
 * the body lives in lib/pages/blog.tsx.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import {BlogPage, blogMetadata} from '~/lib/pages/blog';
import type {RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{store: string; blogHandle: string}>;
type SearchParams = Promise<RawSearchParams>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  return blogMetadata((await params).blogHandle);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const {store, blogHandle} = await params;
  return (
    <BlogPage
      store={requireStore(store)}
      blogHandle={blogHandle}
      searchParams={await searchParams}
    />
  );
}
