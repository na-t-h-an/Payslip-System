import { useEffect, useState } from 'react';
import PayslipPreview from './PayslipPreview';
import { generatePayslip, sendPayslipEmail } from '../../services/api';
import { buildPayslipPDF, getInitials } from '../../utils/buildPayslipPDF';

export default function PayslipModal({ employee, config, company, currency = 'USD', alreadySent, onSent, onClose }) {
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
  const convertedPayPHP = currency === 'PHP' ? totalPayUSD : totalPayUSD * config.exchangeRate;
  const netPay = convertedPayPHP - (employee.transferFee || 0);

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
    deductions: { transferFee: employee.transferFee || 0 },
    netPay,
    currency,
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
      if (employee.id) formData.append('employeeId', employee.id);
      if (config.id) formData.append('payPeriodId', config.id);

      await sendPayslipEmail(formData);
      setEmailSent(true);
      onSent?.();
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
                disabled={sending || !employee.accountNumber}
                title={!employee.accountNumber ? 'Account number is required to send payslip' : ''}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {sending ? 'Sending...' : alreadySent ? 'Resend Payslip to Employee' : 'Send Payslip to Employee'}
              </button>
              {!employee.accountNumber && (
                <p className="mt-2 text-xs text-amber-600">Account number is required before sending. Please edit the employee to add one.</p>
              )}
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