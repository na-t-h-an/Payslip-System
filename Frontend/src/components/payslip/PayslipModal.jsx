import { useEffect } from 'react';
import PayslipPreview from './PayslipPreview';

export default function PayslipModal({ employee, config, onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const bonus = employee.bonus || 0;
  const totalPayUSD = employee.totalPay;
  const convertedPayPHP = totalPayUSD * config.exchangeRate;
  const netPay = convertedPayPHP - config.transferFee;

  const payslipData = {
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

        {/* Payslip Content */}
        <div className="overflow-y-auto p-6">
          <PayslipPreview data={payslipData} />
        </div>
      </div>
    </div>
  );
}
