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
    // fallback: initials box
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
  doc.text(`PHP ${fmtPHP(data.netPay)}`, W - M, y, { align: 'right' });
  y += 13;

  // ── Footer ───────────────────────────────────────────────
  setStyle(8, 'italic', 160, 163, 175);
  doc.text(
    [
      '- This document serves as your official payslip and is system-generated; no signature is required. Transfer fees will be deducted for payments to non-BPI accounts. For any discrepancies, please contact your employer.',
    ].join('\n'),
    M, y, { maxWidth: W - M * 2 }
  );
  return doc.output('blob');
}
