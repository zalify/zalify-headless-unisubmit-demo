/**
 * Home page (single-tenant) — thin wrapper binding the env-configured
 * store; the body lives in lib/pages/home.tsx.
 */
import {defaultStoreConfig} from '~/lib/store-config';
import {HomePage} from '~/lib/pages/home';
import {ZalifyDemo} from '~/components/ZalifyDemo';

const DEMO_WORKSPACE_ID =
  process.env.NEXT_PUBLIC_ZALIFY_WORKSPACE_ID || 'cms55ktzi00i01wr2vivht5n4';

export default function Page() {
  return (
    <>
      <ZalifyDemo
        workspaceId={DEMO_WORKSPACE_ID}
        listId={process.env.NEXT_PUBLIC_ZALIFY_LIST_ID}
      />
      <HomePage store={defaultStoreConfig} />
    </>
  );
}
