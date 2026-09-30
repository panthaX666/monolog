export type PersistState = 'persisted' | 'best-effort' | 'unsupported';

// Ask the browser not to evict our data under storage pressure (SPEC §7).
// Chrome grants this more readily once the app is installed.
export async function requestPersistence(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'persisted';
  return (await navigator.storage.persist()) ? 'persisted' : 'best-effort';
}
