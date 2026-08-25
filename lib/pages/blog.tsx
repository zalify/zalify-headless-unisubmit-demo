/**
 * Blog index body — templates/blog.json (articles grid with cursor
 * pagination, featured post on the first page). Shared by
 * app/(default)/blogs/[blogHandle] and app/s/[store]/blogs/[blogHandle].
 *
 * Blocking SSR (no Cache Components): the page awaits its data before
 * rendering. The fetch is wrapped in a per-store unstable_cache, keyed
 * per (slug, handle, cursor) with tags 'content' + 'content:<slug>'.
 */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getStorefront} from '~/lib/storefront';
import type {StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import {getPaginationVariables, type PaginationVariables} from '~/lib/pagination';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';
import type {RawSearchParams} from './product';

/** Cached per (store, handle, cursor); tag 'content[:<slug>]'. Errors are not cached. */
const queryBlog = storeCache('queryBlog', queryBlogUncached, {
  revalidate: 3600,
  tags: ['content'],
});

async function queryBlogUncached(
  store: StoreConfig,
  blogHandle: string,
  paginationVariables: PaginationVariables,
) {
  return getStorefront(store).query(BLOGS_QUERY, {
    variables: {blogHandle, ...paginationVariables},
  });
}

export function blogMetadata(blogHandle: string): Metadata {
  return {title: `${blogHandle.replace(/-/g, ' ')} blog`};
}

export async function BlogPage({
  store,
  blogHandle,
  searchParams,
}: {
  store: StoreConfig;
  blogHandle: string;
  searchParams: RawSearchParams;
}) {
  const urlParams = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') urlParams.append(name, value);
  }
  const paginationVariables = getPaginationVariables(urlParams, 4);

  const data = await queryBlog(store, blogHandle, paginationVariables).catch(
    (error: unknown) => {
      console.error('[blogs] query failed', error);
      return null;
    },
  );

  const blog = data?.blog;
  if (!blog?.articles) notFound();

  return <ThemeTemplateClient name="blog" resources={{blog}} />;
}

const BLOGS_QUERY = `#graphql
  query Blog(
    $blogHandle: String!
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) {
    blog(handle: $blogHandle) {
      title
      handle
      seo {
        title
        description
      }
      articles(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ArticleItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
  fragment ArticleItem on Article {
    author: authorV2 {
      name
    }
    contentHtml
    handle
    id
    image {
      id
      altText
      url
      width
      height
    }
    publishedAt
    title
    blog {
      handle
    }
  }
` as const;
