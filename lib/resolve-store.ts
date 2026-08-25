/**
 * Server-side helpers for the /s/[store] segment. Kept separate from
 * lib/store-config.ts so the edge middleware never pulls in
 * next/navigation.
 */
import {notFound} from 'next/navigation';
import {getStoreBySlug, type StoreConfig} from './store-config';

/** Resolve the [store] route param; unknown slug → 404. */
export function requireStore(slug: string): StoreConfig {
  const store = getStoreBySlug(slug);
  if (!store) notFound();
  return store;
}
