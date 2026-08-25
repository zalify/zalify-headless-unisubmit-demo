/**
 * Home page (single-tenant) — thin wrapper binding the env-configured
 * store; the body lives in lib/pages/home.tsx.
 */
import {defaultStoreConfig} from '~/lib/store-config';
import {HomePage} from '~/lib/pages/home';

export default function Page() {
  return <HomePage store={defaultStoreConfig} />;
}
