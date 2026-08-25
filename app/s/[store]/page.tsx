/**
 * Home page (multi-tenant) — resolves the store from the [store] slug;
 * the body lives in lib/pages/home.tsx.
 */
import {requireStore} from '~/lib/resolve-store';
import {HomePage} from '~/lib/pages/home';

type Params = Promise<{store: string}>;

export default async function Page({params}: {params: Params}) {
  return <HomePage store={requireStore((await params).store)} />;
}
