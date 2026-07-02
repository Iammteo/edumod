// Dependency-free report exports. Excel opens HTML tables saved as .xls; Word opens .doc HTML;
// PDF uses the browser's print-to-PDF on a styled document. Client-only (uses DOM/Blob).
export type ReportColumn = { key: string; label: string; image?: boolean };
export type ReportRow = Record<string, string | number>;
// Optional totals block rendered (and exported) below the main table - e.g. per-staff tallies.
export type ReportSection = { title: string; columns: ReportColumn[]; rows: ReportRow[] };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// HTML-escape all user-supplied data before it goes into the exported document.
function esc(s: unknown) { return String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!)); }

function cell(c: ReportColumn, r: ReportRow) {
  const v = String(r[c.key] ?? "");
  // Only allow same-origin image paths (uploads / api) as <img src>, escaped — never arbitrary URLs.
  if (c.image) return v && /^\/(uploads|api)\//.test(v) ? `<img src="${esc(v)}" style="height:40px;width:40px;object-fit:cover;border-radius:6px" />` : "-";
  return esc(v);
}
function tableHtml(cols: ReportColumn[], rows: ReportRow[]) {
  const head = cols.map((c) => `<th style="text-align:left;border:1px solid #ccc;padding:6px 10px;background:#eef2f9">${esc(c.label)}</th>`).join("");
  const body = rows.map((r) => `<tr>${cols.map((c) => `<td style="border:1px solid #ccc;padding:6px 10px">${cell(c, r)}</td>`).join("")}</tr>`).join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
function docHtml(title: string, subtitle: string, cols: ReportColumn[], rows: ReportRow[], summary?: ReportSection) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#10213f">
    <h2 style="margin:0">${esc(title)}</h2><p style="color:#5b6b86;margin:4px 0 14px">${esc(subtitle)}</p>
    ${tableHtml(cols, rows)}
    ${summary ? `<h3 style="margin:22px 0 8px">${esc(summary.title)}</h3>${tableHtml(summary.columns, summary.rows)}` : ""}
  </body></html>`;
}
function csvBlock(cols: ReportColumn[], rows: ReportRow[]) {
  return [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => r[c.key] ?? ""))]
    .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// Opens a print window and triggers the browser's print dialog (→ "Save as PDF").
function printWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const script = `<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});<\/script>`;
  w.document.write(html + script);
  w.document.close();
}

/* ---------------- Timetable grid export (PDF / Word) ---------------- */
export type ExportSlot = { subject: string | null; teacher?: string | null; room?: string | null } | null;
export type ExportPeriod = { startTime: string; endTime: string; label: string | null; isBreak: boolean; slots: ExportSlot[] };

function timetableDoc(opts: { title: string; subtitle: string; days: string[]; periods: ExportPeriod[] }) {
  const { title, subtitle, days, periods } = opts;
  const th = 'style="border:1px solid #bcc6d8;padding:7px 9px;background:#eef2f9;font-size:12px;text-align:center"';
  const timeTh = 'style="border:1px solid #bcc6d8;padding:7px 9px;background:#eef2f9;font-size:11px;text-align:left"';
  const head = `<tr><th ${timeTh}>Time</th>${days.map((d) => `<th ${th}>${esc(d)}</th>`).join("")}</tr>`;
  const body = periods.map((p) => {
    const time = `<td style="border:1px solid #bcc6d8;padding:6px 9px;font-size:11px;color:#5b6b86;white-space:nowrap">${esc(p.startTime)}–${esc(p.endTime)}</td>`;
    if (p.isBreak) return `<tr>${time}<td colspan="${days.length}" style="border:1px solid #bcc6d8;padding:7px;text-align:center;font-weight:bold;background:#fdf6e9;color:#b9540f;text-transform:uppercase;font-size:12px">${esc(p.label || "Break")}</td></tr>`;
    const cells = days.map((_d, i) => {
      const s = p.slots[i];
      if (!s || (!s.subject && !s.teacher && !s.room)) return `<td style="border:1px solid #dbe2ee;padding:6px 8px"></td>`;
      const sub = s.subject ? `<strong style="font-size:12px;color:#10213f">${esc(s.subject)}</strong>` : "";
      const tea = s.teacher ? `<br><span style="font-size:10.5px;color:#5b6b86">${esc(s.teacher)}</span>` : "";
      const room = s.room ? `<br><span style="font-size:10.5px;color:#5b6b86">${esc(s.room)}</span>` : "";
      return `<td style="border:1px solid #dbe2ee;padding:6px 8px;vertical-align:top">${sub}${tea}${room}</td>`;
    }).join("");
    return `<tr>${time}${cells}</tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#10213f;margin:24px">
    <h2 style="margin:0">${esc(title)}</h2><p style="color:#5b6b86;margin:4px 0 14px">${esc(subtitle)}</p>
    <table style="border-collapse:collapse;width:100%"><thead>${head}</thead><tbody>${body}</tbody></table>
  </body></html>`;
}

export function exportTimetable(format: "pdf" | "word", opts: { title: string; subtitle: string; days: string[]; periods: ExportPeriod[]; filename: string }) {
  const html = timetableDoc(opts);
  if (format === "word") { download(new Blob([`﻿${html}`], { type: "application/msword" }), `${opts.filename}.doc`); return; }
  printWindow(html);
}

export function exportReport(format: "excel" | "word" | "pdf" | "csv", opts: { title: string; subtitle: string; columns: ReportColumn[]; rows: ReportRow[]; filename: string; summary?: ReportSection }) {
  const { title, subtitle, columns, rows, filename, summary } = opts;
  if (format === "csv") {
    let csv = csvBlock(columns, rows);
    if (summary) csv += `\n\n${summary.title}\n${csvBlock(summary.columns, summary.rows)}`;
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    return;
  }
  const html = docHtml(title, subtitle, columns, rows, summary);
  if (format === "excel") { download(new Blob([html], { type: "application/vnd.ms-excel" }), `${filename}.xls`); return; }
  if (format === "word") { download(new Blob([`﻿${html}`], { type: "application/msword" }), `${filename}.doc`); return; }
  // pdf → open a print window; the user saves as PDF.
  // Wait for every image to finish loading before printing, otherwise the
  // print dialog captures blank <img> boxes (images load async over the network).
  const w = window.open("", "_blank");
  if (!w) return;
  const printScript = `<script>
    function go(){
      var imgs = Array.prototype.slice.call(document.images);
      Promise.all(imgs.map(function(img){
        if (img.complete) return Promise.resolve();
        return new Promise(function(res){ img.addEventListener('load', res); img.addEventListener('error', res); });
      })).then(function(){ setTimeout(function(){ window.focus(); window.print(); }, 200); });
    }
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  <\/script>`;
  w.document.write(html + printScript);
  w.document.close();
}
