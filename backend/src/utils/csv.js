/**
 * Minimal, safe CSV builder.
 *  - Quotes every value and doubles embedded quotes (RFC 4180).
 *  - Neutralises spreadsheet formula injection: values starting with = + - @ tab or CR
 *    are prefixed with a single quote so Excel/Sheets treat them as text.
 */
export function escapeCsvValue(value) {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * @param {{key: string, label: string}[]} columns
 * @param {object[]} rows
 */
export function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(','));
  // Leading BOM makes Excel open UTF-8 files correctly.
  return '﻿' + [header, ...lines].join('\r\n');
}
