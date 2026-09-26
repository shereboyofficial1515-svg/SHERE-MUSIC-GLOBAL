/**
 * Make free-text search input safe to embed in a PostgREST `or=(...)` filter.
 * Removes filter-syntax characters and LIKE wildcards; values are then passed as
 * query parameters, so there is no SQL injection path — this only keeps the
 * filter grammar intact.
 */
export function cleanSearchTerm(input) {
  return String(input ?? '')
    .replace(/[,()*%_\\:"'.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/** Build `col.ilike.*term*,col2.ilike.*term*` for `.or()`. */
export function ilikeAny(columns, term) {
  return columns.map((c) => `${c}.ilike.*${term}*`).join(',');
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
