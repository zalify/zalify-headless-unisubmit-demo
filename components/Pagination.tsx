'use client';
/**
 * Cursor prev/next links styled like the theme's pagination rows — the
 * markup replacement for Hydrogen's <Pagination> PreviousLink/NextLink
 * (same `cursor` + `direction` URL contract, other params preserved).
 */
import Link from 'next/link';
import {usePathname, useSearchParams} from 'next/navigation';
import {t} from '@zalify/storefront-kit/react';
import {paginationUrl, type PageInfo} from '~/lib/pagination';

export function PaginationLinks({
  pageInfo,
  className,
}: {
  pageInfo: PageInfo | undefined;
  className: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!pageInfo?.hasPreviousPage && !pageInfo?.hasNextPage) return null;
  const params = new URLSearchParams(searchParams.toString());
  return (
    <div className={className}>
      {pageInfo.hasPreviousPage ? (
        <Link
          href={paginationUrl(pathname, params, 'previous', pageInfo.startCursor)}
        >
          {`‹ ${t('general.previous')}`}
        </Link>
      ) : null}{' '}
      {pageInfo.hasNextPage ? (
        <Link href={paginationUrl(pathname, params, 'next', pageInfo.endCursor)}>
          {`${t('general.next')} ›`}
        </Link>
      ) : null}
    </div>
  );
}
