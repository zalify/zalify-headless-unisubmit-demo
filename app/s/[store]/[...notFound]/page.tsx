/**
 * Catch-all for unknown paths on a tenant host: triggers the store's
 * not-found boundary so the 404 renders with the tenant's header/footer
 * instead of the global (default-store) not-found page.
 */
import {notFound} from 'next/navigation';

export default function CatchAll(): never {
  notFound();
}
