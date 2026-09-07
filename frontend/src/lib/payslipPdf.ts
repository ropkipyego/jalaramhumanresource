import type { jsPDF } from "jspdf";

export interface PayslipLineItem {
  kind: string;
  code: string;
  label: string;
  amount: number;
}

export interface PayslipPdfInput {
  organizationName?: string;
  periodLabel: string;
  employeeName: string;
  staffId?: string | null;
  kraPin?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  grossEarnings?: number | null;
  totalDeductions?: number | null;
  netPay?: number | null;
  items: PayslipLineItem[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodLabelFrom(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function section(
  doc: jsPDF,
  title: string,
  items: PayslipLineItem[],
  y: number,
  pageWidth: number,
  margin: number
): number {
  if (items.length === 0) return y;
  const right = pageWidth - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, margin, y);
  y += 6;
  doc.setDrawColor(200);
  doc.line(margin, y, right, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let total = 0;
  for (const item of items) {
    if (y > 275) {
      doc.addPage();
      y = margin;
    }
    const amount = Number(item.amount) || 0;
    total += amount;
    doc.text(item.label || item.code || "—", margin, y);
    doc.text(money(amount), right, y, { align: "right" });
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.text(`Total ${title}`, margin, y);
  doc.text(money(total), right, y, { align: "right" });
  return y + 10;
}

/** Generate and download a Jalaram Hospital payslip PDF (loads jsPDF on demand). */
export async function downloadPayslipPdf(input: PayslipPdfInput): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - margin;
  let y = margin;

  const org = input.organizationName || "Jalaram Hospital";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(org, margin, y);
  y += 7;
  doc.setFontSize(12);
  doc.text("Payslip", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Period: ${input.periodLabel}`, margin, y);
  y += 6;
  doc.text(`Employee: ${input.employeeName}`, margin, y);
  y += 6;
  if (input.staffId) {
    doc.text(`Staff ID: ${input.staffId}`, margin, y);
    y += 6;
  }
  if (input.kraPin) {
    doc.text(`KRA PIN: ${input.kraPin}`, margin, y);
    y += 6;
  }
  if (input.bankName || input.bankAccount) {
    doc.text(
      `Bank: ${[input.bankName, input.bankAccount].filter(Boolean).join(" • ") || "—"}`,
      margin,
      y
    );
    y += 8;
  } else {
    y += 2;
  }

  const earnings = input.items.filter((i) => i.kind === "EARNING");
  const deductions = input.items.filter((i) => i.kind === "DEDUCTION");
  const employer = input.items.filter((i) => i.kind === "EMPLOYER_CONTRIB");
  const other = input.items.filter(
    (i) => !["EARNING", "DEDUCTION", "EMPLOYER_CONTRIB"].includes(i.kind)
  );

  y = section(doc, "Earnings", earnings, y, pageWidth, margin);
  y = section(doc, "Deductions", deductions, y, pageWidth, margin);
  y = section(doc, "Employer Contributions", employer, y, pageWidth, margin);
  if (other.length) y = section(doc, "Other", other, y, pageWidth, margin);

  if (y > 260) {
    doc.addPage();
    y = margin;
  }

  doc.setDrawColor(40);
  doc.setLineWidth(0.4);
  doc.line(margin, y, right, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gross earnings: ${money(input.grossEarnings)}`, margin, y);
  y += 6;
  doc.text(`Total deductions: ${money(input.totalDeductions)}`, margin, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Net Pay", margin, y);
  doc.text(money(input.netPay), right, y, { align: "right" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    "This is a computer-generated payslip from Jalaram Hospital HRPMS. For queries contact HR.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 }
  );

  const safeName = (input.employeeName || "employee")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const safePeriod = input.periodLabel.toLowerCase().replace(/\s+/g, "-");
  doc.save(`payslip-${safeName}-${safePeriod}.pdf`);
}
