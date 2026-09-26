/**
 * Build a CSV string. Cells starting with = + - @ are prefixed with a quote so
 * spreadsheet apps do not execute them as formulas (CSV injection).
 */
export function toCsv(columns, rows) {
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    let s = value instanceof Date ? value.toISOString() : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escape(c.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}
