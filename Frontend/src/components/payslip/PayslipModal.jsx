import { useEffect, useState } from 'react';
import PayslipPreview from './PayslipPreview';
import { generatePayslip, sendPayslipEmail } from '../../services/api';

// Builds the PDF from raw data using jsPDF — no html2canvas, no CSS parsing, no oklch issues.
async function buildPayslipPDF(data) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 22;
  let y = 22;

  const fmt2 = (n) => Number(n).toFixed(2);
  const fmtPHP = (n) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2 }).format(n);

  // helpers
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
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(W / 2 - 8, y, 16, 16, 2, 2, 'F');
  setStyle(7, 'bold', 255, 255, 255);
  doc.text(data.companyInitials || '?', W / 2, y + 10.5, { align: 'center' });
  y += 22;

  setStyle(13, 'bold', 31, 41, 55);
  doc.text(data.companyName || 'Company', W / 2, y, { align: 'center' });
  y += 6;

  setStyle(9, 'normal', 160, 163, 175);
  doc.text('Payslip', W / 2, y, { align: 'center' });
  y += 13;

  // ── Recipient ────────────────────────────────────────────
  labelValue('Pay to:', data.payTo);
  labelValue('Pay Period:', data.payPeriod);
  labelValue('Email Address:', data.emailAddress);
  y += 2;
  hr();

  // ── Earnings ─────────────────────────────────────────────
  labelValue('Hours Worked', fmt2(data.hoursWorked));
  labelValue('Agent Rate', `$ ${fmt2(data.agentRate)}`);
  labelValue('Bonus', data.bonus > 0 ? `$ ${fmt2(data.bonus)}` : '$ -');
  labelValue('Total Pay in USD', `$ ${fmt2(data.totalPayUSD)}`);
  labelValue('Current Exchange Rate', `${fmt2(data.currentExchangeRate)}  (PHP / 1USD)`);
  labelValue('Converted Pay in PHP', `PHP ${fmtPHP(data.convertedPayPHP)}`, 37, 99, 235);
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
    '- Please be advised that a transfer fee will be deducted for payments processed through bank transfer.',
    M, y, { maxWidth: W - M * 2 }
  );

  return doc.output('blob');
}

function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

export default function PayslipModal({ employee, config, company, onClose }) {
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const bonus = employee.bonus || 0;
  const totalPayUSD = employee.totalPay;
  const convertedPayPHP = totalPayUSD * config.exchangeRate;
  const netPay = convertedPayPHP - config.transferFee;

  const companyName = company?.name || 'Company';
  const companyInitials = getInitials(company?.name);

  const payslipData = {
    companyName,
    companyInitials,
    payTo: employee.name,
    payPeriod: config.payPeriod,
    emailAddress: employee.email,
    hoursWorked: employee.totalHours,
    agentRate: employee.rate,
    bonus,
    totalPayUSD,
    currentExchangeRate: config.exchangeRate,
    convertedPayPHP,
    deductions: { transferFee: config.transferFee },
    netPay,
  };

  const handleSendEmail = async () => {
    setSending(true);
    setEmailError(null);
    try {
      // 1. Save payslip record to DB
      await generatePayslip({
        employeeId: employee.id,
        payPeriodId: config.id,
        totalHours: employee.totalHours,
        rate: employee.rate,
        bonus: employee.bonus || 0,
        totalPhpPay: convertedPayPHP,
      });

      // 2. Build PDF and send email
      const pdfBlob = await buildPayslipPDF(payslipData);
      const safeFileName = `Payslip_${employee.name.replace(/\s+/g, '_')}.pdf`;

      const formData = new FormData();
      formData.append('pdf', pdfBlob, safeFileName);
      formData.append('email', employee.email);
      formData.append('name', employee.name);
      formData.append('payPeriod', config.payPeriod);

      await sendPayslipEmail(formData);
      setEmailSent(true);
    } catch (err) {
      console.error('Send email error:', err);
      setEmailError(err?.response?.data?.error || err?.message || 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 print:hidden">
          <h2 className="text-base font-semibold text-gray-800">Payslip — {employee.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Payslip Preview */}
        <div className="overflow-y-auto p-6">
          <PayslipPreview data={payslipData} />
        </div>

        {/* Send Email Footer */}
        <div className="flex flex-col items-center border-t border-gray-100 px-6 py-4 print:hidden">
          {emailSent ? (
            <div className="flex items-center gap-2 text-sm font-medium text-green-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Payslip sent to {employee.email}
            </div>
          ) : (
            <>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {sending ? 'Sending...' : 'Send Payslip to Employee'}
              </button>
              {emailError && (
                <p className="mt-2 text-xs text-red-500">{emailError}</p>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}