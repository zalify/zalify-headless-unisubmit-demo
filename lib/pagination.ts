/**
 * Cursor pagination over Storefront API connections — the Next.js
 * mirror of Hydrogen's getPaginationVariables()/<Pagination>. Shares
 * the URL contract (`cursor` + `direction=next|previous`) so sections
 * can keep their `isFirstPage` checks.
 */

export interface PaginationVariables {
  first: number | null;
  last: number | null;
  startCursor: string | null;
  endCursor: string | null;
}

export interface PageInfo {
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

/** URL search params → connection variables (pass into the query). */
export function getPaginationVariables(
  searchParams: URLSearchParams,
  pageBy: number,
): PaginationVariables {
  const cursor = searchParams.get('cursor');
  const isPrevious = searchParams.get('direction') === 'previous';
  return isPrevious
    ? {last: pageBy, startCursor: cursor, first: null, endCursor: null}
    : {first: pageBy, endCursor: cursor, last: null, startCursor: null};
}

/** Build a prev/next page URL preserving the other search params. */
export function paginationUrl(
  pathname: string,
  searchParams: URLSearchParams,
  direction: 'previous' | 'next',
  cursor: string | null | undefined,
): string {
  const params = new URLSearchParams(searchParams);
  if (cursor) params.set('cursor', cursor);
  else params.delete('cursor');
  if (direction === 'previous') params.set('direction', 'previous');
  else params.delete('direction');
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
