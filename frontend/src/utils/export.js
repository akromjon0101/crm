/**
 * export.js — CSV and Print utilities
 * No external libraries needed.
 */

/**
 * Download an array of objects as a CSV file.
 * @param {object[]} rows    - array of plain objects
 * @param {string}   filename - e.g. "students.csv"
 * @param {string[]} [columns] - optional column order (keys)
 */
export function downloadCSV(rows, filename = 'export.csv', columns) {
  if (!rows.length) return;

  const cols = columns || Object.keys(rows[0]);

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    // Wrap in quotes if contains comma, quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = cols.join(',');
  const body   = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n');
  const csv    = `${header}\n${body}`;

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Print a specific DOM element (by id).
 * The element must have content visible in print media.
 */
export function printElement(elementId, title = '') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          color: #111827;
          margin: 20px;
          background: white;
        }
        h2 { font-size: 15px; margin-bottom: 4px; }
        p  { margin: 0; color: #6B7280; font-size: 11px; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 14px;
          font-size: 11px;
        }
        th {
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          padding: 6px 8px;
          text-align: center;
          font-weight: 600;
          color: #374151;
        }
        th.name-col { text-align: left; min-width: 140px; }
        td {
          border: 1px solid #F3F4F6;
          padding: 5px 6px;
          text-align: center;
          font-size: 11px;
        }
        td.name-col { text-align: left; font-weight: 500; }
        .present { background: #22C55E; color: white; font-weight: 700; border-radius: 3px; padding: 1px 4px; }
        .absent  { background: #EF4444; color: white; font-weight: 700; border-radius: 3px; padding: 1px 4px; }
        @media print {
          body { margin: 10px; }
        }
      </style>
    </head>
    <body>${el.innerHTML}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}
