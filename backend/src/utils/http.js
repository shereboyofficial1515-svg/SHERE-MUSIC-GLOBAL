/** Consistent JSON response helpers: `{ data, meta? }`. Errors use `{ error }` (see error middleware). */
export const ok = (res, data, meta) => res.status(200).json(meta ? { data, meta } : { data });
export const created = (res, data) => res.status(201).json({ data });
export const noContent = (res) => res.status(204).end();

/** Range + meta for page/limit pagination. */
export function pageRange({ page, limit }) {
  const from = (page - 1) * limit;
  return { from, to: from + limit - 1 };
}

export function pageMeta({ page, limit }, total) {
  const count = total ?? 0;
  return {
    page,
    limit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
    hasMore: page * limit < count,
  };
}
