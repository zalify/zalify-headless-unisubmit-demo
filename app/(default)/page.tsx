/**
 * Home page (single-tenant) — thin wrapper binding the env-configured
 * store; the body lives in lib/pages/home.tsx.
 */
import {defaultStoreConfig} from '~/lib/store-config';
import {HomePage} from '~/lib/pages/home';
import {ZalifyDemo} from '~/components/ZalifyDemo';
import {
  ZALIFY_DEMO_LIST_ID,
  ZALIFY_DEMO_WORKSPACE_ID,
} from '~/lib/zalify-demo-config';

export default function Page() {
  return (
    <>
      <ZalifyDemo
        workspaceId={ZALIFY_DEMO_WORKSPACE_ID}
        listId={ZALIFY_DEMO_LIST_ID}
      />
      <HomePage store={defaultStoreConfig} />
    </>
  );
}
