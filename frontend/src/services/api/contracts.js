/** @typedef {{next: string|null, previous?: string|null, results: Array<object>}} CursorPage */
/** @typedef {{id: number, username: string, full_name?: string, profile_picture?: string|null}} PublicUser */
/** @typedef {{access: string, refresh: string}} TokenPair */

// Legacy arrays and existing DRF cursor envelopes remain accepted during the migration.
export const readPage = (data) => ({
  items: Array.isArray(data) ? data : (data?.results || []),
  next: Array.isArray(data) ? null : (data?.next || null),
});

export const mergeById = (existing, incoming) => {
  const items = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => items.set(item.id, item));
  return [...items.values()];
};
