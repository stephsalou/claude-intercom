const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function assertSafeId(id: string, label: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error(`Invalid ${label}: "${id}"`);
  }
}
