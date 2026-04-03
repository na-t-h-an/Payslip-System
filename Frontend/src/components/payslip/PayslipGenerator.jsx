import { useState } from 'react';
import EmployeeSearchDropdown from './EmployeeSearchDropdown';
import PayslipPreview from './PayslipPreview';
import PayslipPrintWrapper from './PayslipPrintWrapper';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../shared/LoadingSpinner';
import { usePayslip } from '../../hooks/usePayslip';
import { DEFAULT_PAY_PERIOD, DEFAULT_EXCHANGE_RATE, DEFAULT_TRANSFER_FEE } from '../../constants/payroll';

export default function PayslipGenerator() {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [config, setConfig] = useState({
    payPeriod: DEFAULT_PAY_PERIOD,
    exchangeRate: DEFAULT_EXCHANGE_RATE,
    transferFee: DEFAULT_TRANSFER_FEE,
    bonusOverride: '',
  });

  const { payslip, loading } = usePayslip(selectedEmployee?.id, config);

  const handlePrint = () => window.print();

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Left Panel — Form */}
      <div className="form-panel space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Generate Payslip</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Pay to (Employee)</label>
          <EmployeeSearchDropdown
            selected={selectedEmployee}
            onSelect={setSelectedEmployee}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Pay Period</label>
          <input
            type="text"
            value={config.payPeriod}
            onChange={e => updateConfig('payPeriod', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Exchange Rate (PHP / 1 USD)</label>
          <input
            type="number"
            step="0.01"
            value={config.exchangeRate}
            onChange={e => updateConfig('exchangeRate', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Transfer Fee (PHP)</label>
          <input
            type="number"
            step="0.01"
            value={config.transferFee}
            onChange={e => updateConfig('transferFee', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Bonus Override (USD)
            <span className="ml-2 text-xs font-normal text-gray-400">— Leave blank to use existing</span>
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="e.g. 20.00"
            value={config.bonusOverride}
            onChange={e => updateConfig('bonusOverride', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <button
          onClick={handlePrint}
          disabled={!selectedEmployee || loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Right Panel — Preview */}
      <div className="preview-panel">
        {loading && <LoadingSpinner />}
        {!loading && payslip ? (
          <PayslipPrintWrapper>
            <PayslipPreview data={payslip} />
          </PayslipPrintWrapper>
        ) : (
          !loading && <EmptyState message="Select an employee to preview their payslip." />
        )}
      </div>
    </div>
  );
}
