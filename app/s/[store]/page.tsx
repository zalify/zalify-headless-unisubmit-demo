/**
 * Home page (multi-tenant) — resolves the store from the [store] slug;
 * the body lives in lib/pages/home.tsx.
 */
import {requireStore} from '~/lib/resolve-store';
import {HomePage} from '~/lib/pages/home';
import {ZalifyDemo} from '~/components/ZalifyDemo';

type Params = Promise<{store: string}>;

const DEMO_WORKSPACE_ID =
  process.env.NEXT_PUBLIC_ZALIFY_WORKSPACE_ID || 'cms55ktzi00i01wr2vivht5n4';

export default async function Page({params}: {params: Params}) {
  return (
    <>
      <ZalifyDemo
        workspaceId={DEMO_WORKSPACE_ID}
        listId={process.env.NEXT_PUBLIC_ZALIFY_LIST_ID}
      />
      <HomePage store={requireStore((await params).store)} />
    </>
  );
}
