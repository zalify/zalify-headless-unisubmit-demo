/**
 * Article page (multi-tenant) — resolves the store from the [store]
 * slug; the body lives in lib/pages/article.tsx.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import {ArticlePage, articleMetadata} from '~/lib/pages/article';

type Params = Promise<{store: string; blogHandle: string; articleHandle: string}>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const {store, blogHandle, articleHandle} = await params;
  return articleMetadata(requireStore(store), blogHandle, articleHandle);
}

export default async function Page({params}: {params: Params}) {
  const {store, blogHandle, articleHandle} = await params;
  return (
    <ArticlePage
      store={requireStore(store)}
      blogHandle={blogHandle}
      articleHandle={articleHandle}
    />
  );
}
