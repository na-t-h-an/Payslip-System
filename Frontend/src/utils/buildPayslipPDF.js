import dmaLogoUrl from '../assets/DMA.png';

export function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

export async function buildPayslipPDF(data) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 22;
  let y = 22;

  const fmt2 = (n) => Number(n).toFixed(2);
  const fmtPHP = (n) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2 }).format(n);
  // jsPDF built-in fonts (Helvetica) don't support ₱ (U+20B1) — replace with PHP
  // Also collapse newlines (Excel Alt+Enter line breaks) into a single space
  const safe = (str) => String(str || '').replace(/₱/g, 'PHP').replace(/[\r\n]+/g, ' ').trim();

  const setStyle = (size, weight, r, g, b) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', weight);
    doc.setTextColor(r, g, b);
  };

  const hr = (weight = 0.3) => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(weight);
    doc.line(M, y, W - M, y);
    y += 7;
  };

  const labelValue = (label, value, vR = 31, vG = 41, vB = 55) => {
    setStyle(10, 'normal', 107, 114, 128);
    doc.text(label, M, y);
    setStyle(10, 'bold', vR, vG, vB);
    doc.text(value, W - M, y, { align: 'right' });
    y += 7;
  };

  // ── Header ──────────────────────────────────────────────
  const logoW = 60;
  const logoH = 30;
  try {
    doc.addImage(dmaLogoUrl, 'PNG', W / 2 - logoW / 2, y, logoW, logoH);
  } catch {
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(W / 2 - 8, y, 16, 16, 2, 2, 'F');
    setStyle(7, 'bold', 255, 255, 255);
    doc.text(data.companyInitials || '?', W / 2, y + 10.5, { align: 'center' });
  }
  y += logoH + 5;

  setStyle(9, 'normal', 160, 163, 175);
  doc.text('Payslip', W / 2, y, { align: 'center' });
  y += 13;

  // ── Recipient ────────────────────────────────────────────
  labelValue('Pay to:', data.payTo);
  labelValue('Pay Period:', data.payPeriod);
  labelValue('Email Address:', data.emailAddress);
  y += 2;
  hr();

  const isUSD = (data.currency || 'USD') === 'USD';

  // ── Earnings ─────────────────────────────────────────────
  if (data.dynamicColumns) {
    // PHP dynamic mode — pair consecutive same-type columns into 2-col rows
    const mid = W / 2;

    // Truncate a label to fit within maxMm — measures actual text width via jsPDF
    const truncLabel = (str, maxMm) => {
      const s = safe(str);
      setStyle(10, 'normal', 107, 114, 128);
      if (doc.getTextWidth(s) <= maxMm) return s;
      let t = s;
      while (t.length > 1 && doc.getTextWidth(t + '...') > maxMm) t = t.slice(0, -1);
      return t + '...';
    };

    let i = 0;
    while (i < data.dynamicColumns.length) {
      const col  = data.dynamicColumns[i];
      const next = data.dynamicColumns[i + 1];
      const pair = next && col.isNumber === next.isNumber;
      if (pair) {
        // Left col: label at M, value right-aligned at mid-4
        // Right col: label at mid+4, value right-aligned at W-M
        // ~50mm per label leaves room for values (e.g. "PHP 10,400.00" ~25mm)
        setStyle(10, 'normal', 107, 114, 128);
        doc.text(truncLabel(col.label, 50), M, y);
        setStyle(10, 'bold', 31, 41, 55);
        doc.text(safe(col.value), mid - 4, y, { align: 'right' });
        setStyle(10, 'normal', 107, 114, 128);
        doc.text(truncLabel(next.label, 50), mid + 4, y);
        setStyle(10, 'bold', 31, 41, 55);
        doc.text(safe(next.value), W - M, y, { align: 'right' });
        y += 8;
        i += 2;
      } else {
        setStyle(10, 'normal', 107, 114, 128);
        doc.text(truncLabel(col.label, 100), M, y);
        setStyle(10, 'bold', 31, 41, 55);
        doc.text(safe(col.value), W - M, y, { align: 'right' });
        y += 8;
        i += 1;
      }
    }
  } else {
    // Standard fixed layout
    labelValue('Hours Worked', fmt2(data.hoursWorked));
    if (isUSD) {
      labelValue('Agent Rate', `$ ${fmt2(data.agentRate)}`);
      labelValue('Bonus', data.bonus > 0 ? `$ ${fmt2(data.bonus)}` : '$ -');
      labelValue('Total Pay in USD', `$ ${fmt2(data.totalPayUSD)}`);
      labelValue('Current Exchange Rate', `${fmt2(data.currentExchangeRate)}  (PHP / 1USD)`);
      labelValue('Converted Pay in PHP', `PHP ${fmtPHP(data.convertedPayPHP)}`, 37, 99, 235);
    } else {
      labelValue('Agent Rate', `PHP ${fmtPHP(data.agentRate)}`);
      labelValue('Bonus', data.bonus > 0 ? `PHP ${fmtPHP(data.bonus)}` : 'PHP -');
      labelValue('Total Pay', `PHP ${fmtPHP(data.totalPayUSD)}`, 37, 99, 235);
    }
  }
  y += 2;

  // ── Deductions ───────────────────────────────────────────
  setStyle(8, 'bold', 180, 183, 189);
  doc.text('DEDUCTIONS', M, y);
  y += 7;
  labelValue('Transfer Fee', `PHP ${fmt2(data.deductions.transferFee)}`);
  y += 2;
  hr(0.8);

  // ── Net Pay ──────────────────────────────────────────────
  setStyle(14, 'bold', 31, 41, 55);
  doc.text('NET PAY', M, y);
  setStyle(14, 'bold', 22, 163, 74);
  doc.text(safe(`PHP ${fmtPHP(data.netPay)}`), W - M, y, { align: 'right' });
  y += 13;

  // ── Footer ───────────────────────────────────────────────
  setStyle(8, 'italic', 160, 163, 175);
  doc.text(
    '- This document serves as your official payslip and is system-generated; no signature is required. Transfer fees will be deducted for payments to non-BPI accounts. For any discrepancies, please contact your employer.',
    M, y, { maxWidth: W - M * 2 }
  );
  return doc.output('blob');
}
