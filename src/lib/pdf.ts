import PDFDocument from "pdfkit";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * Server-side PDF generation for institutional account statements.
 * Uses pdfkit to render a professional, dark-themed statement document.
 */

export interface StatementData {
  investorName: string;
  investorEmail: string;
  investorId: string;
  kycTier: string;
  fundName: string;
  fundDescription: string;
  periodStart: Date;
  periodEnd: Date;
  navStart: number;
  navEnd: number;
  aum: number;
  unitsStart: number;
  unitsEnd: number;
  avgCost: number;
  currentValue: number;
  unrealizedPnl: number;
  periodReturnPct: number;
  inceptionReturnPct: number;
  sharpe: number;
  maxDrawdown: number;
  managementFee: string;
  performanceFee: string;
  transactions: Array<{
    date: Date;
    type: string;
    amount: number;
    status: string;
  }>;
}

// Brand palette
const GOLD = "#D4AF37";
const GOLD_SOFT = "#B8941F";
const NEAR_BLACK = "#0a0a0b";
const DARK_BG = "#141416";
const CARD_BG = "#1a1a1d";
const BORDER = "#2a2a2e";
const TEXT_PRIMARY = "#f5f5f4";
const TEXT_SECONDARY = "#9a9a9a";
const TEXT_MUTED = "#6a6a6a";
const PROFIT = "#22c55e";
const LOSS = "#ef4444";

const fmtMoney = (n: number, decimals = 2): string => {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const fmtUSD = (n: number, decimals = 2): string => `$${fmtMoney(n, decimals)}`;

const fmtPct = (n: number, decimals = 2): string => {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
};

const fmtDateLong = (d: Date): string =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const fmtDateShort = (d: Date): string =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });

const fmtPeriod = (start: Date, end: Date): string =>
  `${start.toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

export function generateMonthlyStatement(data: StatementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // A4 page with comfortable margins. Higher DPI for crisp text.
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
        info: {
          Title: `Account Statement — ${data.investorName}`,
          Author: "Nightmare Invest LLC",
          Subject: `Official Account Statement (${fmtPeriod(data.periodStart, data.periodEnd)})`,
          Producer: "Nightmare Invest PDF Engine",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Page dimensions (A4)
      const PAGE_W = 595.28;
      const CONTENT_W = PAGE_W - 100; // 50px margins both sides

      // ─────────────────────────────────────────────────────────────
      // Helpers
      // ─────────────────────────────────────────────────────────────

      const fillRect = (x: number, y: number, w: number, h: number, color: string) => {
        doc.save().rect(x, y, w, h).fillColor(color).fill().restore();
      };

      const strokeRect = (x: number, y: number, w: number, h: number, color: string, lineWidth = 1) => {
        doc.save().rect(x, y, w, h).lineWidth(lineWidth).strokeColor(color).stroke().restore();
      };

      const fillText = (
        text: string,
        x: number,
        y: number,
        opts: {
          font?: string;
          size?: number;
          color?: string;
          align?: "left" | "right" | "center";
          width?: number;
          lineGap?: number;
        } = {}
      ) => {
        const { font = "Helvetica", size = 10, color = TEXT_PRIMARY, align = "left", width, lineGap = 0 } = opts;
        doc.save();
        doc.font(font).fontSize(size).fillColor(color);
        if (width !== undefined) {
          doc.text(text, x, y, { width, align, lineGap });
        } else if (align === "right") {
          doc.text(text, x, y, { align: "right" });
        } else if (align === "center") {
          doc.text(text, x, y, { align: "center" });
        } else {
          doc.text(text, x, y, { lineGap });
        }
        doc.restore();
      };

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > doc.page.height - 80) {
          doc.addPage();
          doc.y = 50;
        }
      };

      // ─────────────────────────────────────────────────────────────
      // 1. PAGE BACKGROUND
      // ─────────────────────────────────────────────────────────────
      fillRect(0, 0, PAGE_W, doc.page.height, NEAR_BLACK);

      // ─────────────────────────────────────────────────────────────
      // 2. HEADER — Brand band with gold accent line
      // ─────────────────────────────────────────────────────────────
      const headerY = 50;

      // Gold hairline at top of header
      doc.save();
      doc.rect(50, headerY, CONTENT_W, 1.5).fillColor(GOLD).fill();
      doc.restore();

      // Wordmark
      fillText("NIGHTMARE", 50, headerY + 14, {
        font: "Helvetica-Bold",
        size: 20,
        color: TEXT_PRIMARY,
        lineGap: 0,
      });
      fillText("INVEST", 50, headerY + 36, {
        font: "Helvetica-Bold",
        size: 20,
        color: GOLD,
        lineGap: 0,
      });

      // Right side — statement type + period
      fillText("OFFICIAL ACCOUNT STATEMENT", PAGE_W - 50, headerY + 14, {
        font: "Helvetica-Bold",
        size: 11,
        color: GOLD,
        align: "right",
        width: 200,
      });
      fillText(fmtPeriod(data.periodStart, data.periodEnd), PAGE_W - 50, headerY + 30, {
        font: "Helvetica",
        size: 10,
        color: TEXT_SECONDARY,
        align: "right",
        width: 200,
      });
      fillText(`Generated ${fmtDateLong(new Date())}`, PAGE_W - 50, headerY + 44, {
        font: "Helvetica",
        size: 9,
        color: TEXT_MUTED,
        align: "right",
        width: 200,
      });

      // Separator
      doc.y = headerY + 70;
      doc.save();
      doc.rect(50, doc.y, CONTENT_W, 0.5).fillColor(BORDER).fill();
      doc.restore();
      doc.y += 18;

      // ─────────────────────────────────────────────────────────────
      // 3. INVESTOR + FUND INFO — two-column band
      // ─────────────────────────────────────────────────────────────
      const infoY = doc.y;
      const colW = (CONTENT_W - 20) / 2;

      // Investor card (left)
      fillRect(50, infoY, colW, 90, CARD_BG);
      strokeRect(50, infoY, colW, 90, BORDER);
      fillText("INVESTOR", 60, infoY + 10, {
        font: "Helvetica-Bold",
        size: 8,
        color: GOLD,
      });
      fillText(data.investorName, 60, infoY + 26, {
        font: "Helvetica-Bold",
        size: 12,
        color: TEXT_PRIMARY,
      });
      fillText(data.investorEmail, 60, infoY + 44, {
        font: "Helvetica",
        size: 9,
        color: TEXT_SECONDARY,
      });
      fillText(`Account ID: ${data.investorId.slice(0, 8).toUpperCase()}`, 60, infoY + 60, {
        font: "Helvetica",
        size: 9,
        color: TEXT_SECONDARY,
      });
      fillText(`KYC Tier: ${data.kycTier}`, 60, infoY + 74, {
        font: "Helvetica-Bold",
        size: 9,
        color: GOLD,
      });

      // Fund card (right)
      const rightX = 50 + colW + 20;
      fillRect(rightX, infoY, colW, 90, CARD_BG);
      strokeRect(rightX, infoY, colW, 90, BORDER);
      fillText("FUND", rightX + 10, infoY + 10, {
        font: "Helvetica-Bold",
        size: 8,
        color: GOLD,
      });
      fillText(data.fundName, rightX + 10, infoY + 26, {
        font: "Helvetica-Bold",
        size: 12,
        color: TEXT_PRIMARY,
        width: colW - 20,
      });
      fillText(`NAV (Period Start): ${data.navStart.toFixed(4)}`, rightX + 10, infoY + 46, {
        font: "Helvetica",
        size: 9,
        color: TEXT_SECONDARY,
      });
      fillText(`NAV (Period End): ${data.navEnd.toFixed(4)}`, rightX + 10, infoY + 60, {
        font: "Helvetica-Bold",
        size: 9,
        color: GOLD,
      });
      fillText(`AUM: ${fmtUSD(data.aum, 0)}`, rightX + 10, infoY + 74, {
        font: "Helvetica",
        size: 9,
        color: TEXT_SECONDARY,
      });

      doc.y = infoY + 110;

      // ─────────────────────────────────────────────────────────────
      // 4. POSITION SUMMARY
      // ─────────────────────────────────────────────────────────────
      ensureSpace(140);
      fillText("POSITION SUMMARY", 50, doc.y, {
        font: "Helvetica-Bold",
        size: 10,
        color: GOLD,
      });
      doc.y += 16;

      const psY = doc.y;
      const psRowH = 22;
      const labelW = 200;
      const valueX = 50 + labelW;

      // Row backgrounds
      const rows = [
        { label: "Units Held (Start)", value: fmtMoney(data.unitsStart, 4), color: TEXT_PRIMARY },
        { label: "Units Held (End)", value: fmtMoney(data.unitsEnd, 4), color: TEXT_PRIMARY },
        { label: "Average Cost Basis", value: fmtUSD(data.avgCost, 4), color: TEXT_PRIMARY },
        { label: "Current Market Value", value: fmtUSD(data.currentValue, 2), color: GOLD, bold: true },
        {
          label: "Unrealized P&L",
          value: `${data.unrealizedPnl >= 0 ? "+" : ""}${fmtUSD(data.unrealizedPnl, 2)}  (${fmtPct(data.unrealizedPnl / (data.avgCost * data.unitsEnd) * 100)})`,
          color: data.unrealizedPnl >= 0 ? PROFIT : LOSS,
          bold: true,
        },
      ];

      rows.forEach((row, i) => {
        const bg = i % 2 === 0 ? CARD_BG : DARK_BG;
        fillRect(50, psY + i * psRowH, CONTENT_W, psRowH, bg);
        // Subtle bottom border
        doc.save();
        doc.rect(50, psY + (i + 1) * psRowH - 0.5, CONTENT_W, 0.5).fillColor(BORDER).fill();
        doc.restore();

        fillText(row.label, 60, psY + i * psRowH + 7, {
          font: "Helvetica",
          size: 10,
          color: TEXT_SECONDARY,
        });
        fillText(row.value, valueX, psY + i * psRowH + 7, {
          font: row.bold ? "Helvetica-Bold" : "Helvetica-Bold",
          size: 10,
          color: row.color,
          align: "right",
          width: CONTENT_W - labelW - 20,
        });
      });
      // Top + bottom border
      strokeRect(50, psY, CONTENT_W, rows.length * psRowH, BORDER);
      doc.y = psY + rows.length * psRowH + 24;

      // ─────────────────────────────────────────────────────────────
      // 5. TRANSACTION ACTIVITY
      // ─────────────────────────────────────────────────────────────
      ensureSpace(80);
      fillText("TRANSACTION ACTIVITY (PERIOD)", 50, doc.y, {
        font: "Helvetica-Bold",
        size: 10,
        color: GOLD,
      });
      doc.y += 16;

      const txY = doc.y;
      // Table header
      const colDate = 60;
      const colType = 200;
      const colAmount = 340;
      const colStatus = 470;

      fillRect(50, txY, CONTENT_W, 22, "#202024");
      strokeRect(50, txY, CONTENT_W, 22, BORDER);
      fillText("DATE", colDate, txY + 7, { font: "Helvetica-Bold", size: 8, color: GOLD });
      fillText("TYPE", colType, txY + 7, { font: "Helvetica-Bold", size: 8, color: GOLD });
      fillText("AMOUNT (USD)", colAmount, txY + 7, { font: "Helvetica-Bold", size: 8, color: GOLD, align: "right", width: 110 });
      fillText("STATUS", colStatus, txY + 7, { font: "Helvetica-Bold", size: 8, color: GOLD });

      doc.y = txY + 22;

      if (data.transactions.length === 0) {
        fillRect(50, doc.y, CONTENT_W, 28, DARK_BG);
        strokeRect(50, doc.y, CONTENT_W, 28, BORDER);
        fillText("No transaction activity during this period.", 60, doc.y + 9, {
          font: "Helvetica-Oblique",
          size: 9,
          color: TEXT_MUTED,
        });
        doc.y += 28;
      } else {
        data.transactions.forEach((tx, i) => {
          ensureSpace(22);
          // Recompute txY because we may have moved to a new page
          const rowY = doc.y;
          const bg = i % 2 === 0 ? CARD_BG : DARK_BG;
          fillRect(50, rowY, CONTENT_W, 22, bg);
          doc.save();
          doc.rect(50, rowY + 22 - 0.5, CONTENT_W, 0.5).fillColor(BORDER).fill();
          doc.restore();

          fillText(fmtDateShort(tx.date), colDate, rowY + 7, {
            font: "Helvetica",
            size: 9,
            color: TEXT_PRIMARY,
          });
          fillText(tx.type, colType, rowY + 7, {
            font: "Helvetica-Bold",
            size: 9,
            color: tx.type === "DEPOSIT" ? PROFIT : tx.type === "WITHDRAWAL" ? LOSS : TEXT_PRIMARY,
          });
          fillText(fmtUSD(tx.amount, 2), colAmount, rowY + 7, {
            font: "Helvetica-Bold",
            size: 9,
            color: TEXT_PRIMARY,
            align: "right",
            width: 110,
          });
          const statusColor = tx.status === "APPROVED" ? PROFIT : tx.status === "PENDING" ? GOLD : LOSS;
          fillText(tx.status, colStatus, rowY + 7, {
            font: "Helvetica-Bold",
            size: 8,
            color: statusColor,
          });

          doc.y = rowY + 22;
        });
        strokeRect(50, txY, CONTENT_W, doc.y - txY, BORDER);
      }
      doc.y += 24;

      // ─────────────────────────────────────────────────────────────
      // 6. PERFORMANCE METRICS — 2x2 grid
      // ─────────────────────────────────────────────────────────────
      ensureSpace(120);
      fillText("PERFORMANCE METRICS", 50, doc.y, {
        font: "Helvetica-Bold",
        size: 10,
        color: GOLD,
      });
      doc.y += 16;

      const pmY = doc.y;
      const pmCellW = (CONTENT_W - 12) / 2;
      const pmCellH = 50;

      const metrics = [
        { label: "PERIOD RETURN", value: fmtPct(data.periodReturnPct), color: data.periodReturnPct >= 0 ? PROFIT : LOSS },
        { label: "SINCE INCEPTION RETURN", value: fmtPct(data.inceptionReturnPct), color: data.inceptionReturnPct >= 0 ? PROFIT : LOSS },
        { label: "SHARPE RATIO", value: data.sharpe.toFixed(2), color: GOLD },
        { label: "MAX DRAWDOWN", value: `${data.maxDrawdown.toFixed(2)}%`, color: LOSS },
      ];

      metrics.forEach((m, i) => {
        const r = Math.floor(i / 2);
        const c = i % 2;
        const x = 50 + c * (pmCellW + 12);
        const y = pmY + r * (pmCellH + 8);

        fillRect(x, y, pmCellW, pmCellH, CARD_BG);
        strokeRect(x, y, pmCellW, pmCellH, BORDER);

        fillText(m.label, x + 12, y + 9, {
          font: "Helvetica-Bold",
          size: 8,
          color: TEXT_SECONDARY,
        });
        fillText(m.value, x + 12, y + 24, {
          font: "Helvetica-Bold",
          size: 16,
          color: m.color,
        });
      });
      doc.y = pmY + 2 * (pmCellH + 8) + 8;

      // ─────────────────────────────────────────────────────────────
      // 7. FEE DISCLOSURE
      // ─────────────────────────────────────────────────────────────
      ensureSpace(100);
      fillText("FEE DISCLOSURE", 50, doc.y, {
        font: "Helvetica-Bold",
        size: 10,
        color: GOLD,
      });
      doc.y += 16;

      const fdY = doc.y;
      fillRect(50, fdY, CONTENT_W, 70, CARD_BG);
      strokeRect(50, fdY, CONTENT_W, 70, BORDER);

      fillText("Management Fee", 60, fdY + 12, {
        font: "Helvetica",
        size: 9,
        color: TEXT_SECONDARY,
      });
      fillText(data.managementFee, 60, fdY + 26, {
        font: "Helvetica-Bold",
        size: 11,
        color: TEXT_PRIMARY,
      });

      fillText("Performance Fee", 240, fdY + 12, {
        font: "Helvetica",
        size: 9,
        color: TEXT_SECONDARY,
      });
      fillText(data.performanceFee, 240, fdY + 26, {
        font: "Helvetica-Bold",
        size: 11,
        color: TEXT_PRIMARY,
      });

      fillText("High-Water Mark", 60, fdY + 48, {
        font: "Helvetica-Oblique",
        size: 8,
        color: TEXT_MUTED,
        width: CONTENT_W - 20,
      });

      doc.y = fdY + 80;

      // ─────────────────────────────────────────────────────────────
      // 8. FOOTER + DISCLAIMER (on every page)
      // ─────────────────────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Footer hairline
        doc.save();
        doc.rect(50, doc.page.height - 60, CONTENT_W, 0.5).fillColor(BORDER).fill();
        doc.restore();

        // Footer text
        fillText(
          `Confidential — Prepared for ${data.investorName}. Generated on ${fmtDateLong(new Date())}. Nightmare Invest LLC.`,
          50,
          doc.page.height - 54,
          {
            font: "Helvetica",
            size: 7.5,
            color: TEXT_MUTED,
            width: CONTENT_W,
          }
        );
        fillText(
          "This document is confidential and intended solely for the named recipient. Unauthorized distribution is prohibited. Performance figures are net of fees and past performance does not guarantee future results. Crypto asset investments carry significant risk including total loss of principal.",
          50,
          doc.page.height - 42,
          {
            font: "Helvetica-Oblique",
            size: 6.5,
            color: TEXT_MUTED,
            width: CONTENT_W,
            lineGap: 1,
          }
        );

        // Page number (right side)
        fillText(`Page ${i + 1} of ${range.count}`, PAGE_W - 50, doc.page.height - 28, {
          font: "Helvetica",
          size: 7.5,
          color: TEXT_MUTED,
          align: "right",
          width: 100,
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Save a PDF buffer to /download/statements/{fileName} and return the relative path.
 * Ensures the directory exists.
 */
export async function savePdfToDisk(buffer: Buffer, fileName: string): Promise<string> {
  const dir = join(process.cwd(), "download", "statements");
  await mkdir(dir, { recursive: true });
  const fullPath = join(dir, fileName);
  await writeFile(fullPath, buffer);
  // Return a relative path that mirrors the on-disk layout
  return `/download/statements/${fileName}`;
}

/**
 * Save a generic uploaded file to /download/documents/{fileName} and return the relative path.
 */
export async function saveUploadedFileToDisk(buffer: Buffer, fileName: string): Promise<string> {
  const dir = join(process.cwd(), "download", "documents");
  await mkdir(dir, { recursive: true });
  const fullPath = join(dir, fileName);
  await writeFile(fullPath, buffer);
  return `/download/documents/${fileName}`;
}
