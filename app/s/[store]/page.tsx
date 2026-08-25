/**
 * Home page (multi-tenant) — resolves the store from the [store] slug;
 * the body lives in lib/pages/home.tsx.
 */
import {requireStore} from '~/lib/resolve-store';
import {HomePage} from '~/lib/pages/home';
import {ZalifyDemo} from '~/components/ZalifyDemo';
import {
  ZALIFY_DEMO_LIST_ID,
  ZALIFY_DEMO_WORKSPACE_ID,
} from '~/lib/zalify-demo-config';

type Params = Promise<{store: string}>;

export default async function Page({params}: {params: Params}) {
  return (
    <>
      <ZalifyDemo
        workspaceId={ZALIFY_DEMO_WORKSPACE_ID}
        listId={ZALIFY_DEMO_LIST_ID}
      />
      <HomePage store={requireStore((await params).store)} />
    </>
  );
}
