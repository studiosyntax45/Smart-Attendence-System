
import { FileSpreadsheet, Printer } from "lucide-react";
import {
  toCsv,
  toPrintableHtml,
  slugifyFilename,
  type ExportColumn,
  type ExportRow,
} from "@/lib/export";
import { Button } from "@/components/ui/button";


export function ExportMenu({
  filename,
  title,
  subtitle,
  columns,
  rows,
}: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}) {
  const disabled = rows.length === 0;
  const base = slugifyFilename(filename);

  function downloadCsv() {
    const csv = toCsv(columns, rows);
    const blob = new Blob(["Ã¯Â»Â¿", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    const html = toPrintableHtml({ title, subtitle, columns, rows });
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.srcdoc = html;
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) return;
      win.focus();
      win.print();
      window.setTimeout(() => iframe.remove(), 1000);
    };
    document.body.appendChild(iframe);
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={downloadCsv}
        disabled={disabled}
        title="Download as CSV"
      >
        <FileSpreadsheet className="size-4" aria-hidden="true" />
        CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={printPdf}
        disabled={disabled}
        title="Export as PDF (print dialog)"
      >
        <Printer className="size-4" aria-hidden="true" />
        PDF
      </Button>
    </div>
  );
}
