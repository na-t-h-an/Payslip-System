import { formatPHP } from '../../utils/formatCurrency';

export default function PayslipPreview({ data }) {
  return (
    <div className="payslip-card rounded-lg border border-gray-200 bg-white p-8 shadow-md" id="payslip-print-area">
      {/* Header */}
      <div className="mb-6 text-center">
        <img src="/icon.ico" alt="Logo" className="mx-auto mb-2 h-16 w-auto object-contain" />
        <p className="text-xs text-gray-400">Payslip</p>
      </div>

      {/* Recipient Info */}
      <div className="mb-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Pay to:</span>
          <span className="text-sm font-medium text-gray-900">{data.payTo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Pay Period:</span>
          <span className="text-sm text-gray-700">{data.payPeriod}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Email Address:</span>
          <span className="text-sm text-gray-700">{data.emailAddress}</span>
        </div>
      </div>

      <hr className="my-4 border-gray-200" />

      {/* Earnings */}
      <div className="mb-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Hours Worked</span>
          <span className="text-sm text-gray-900">{data.hoursWorked.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Agent Rate</span>
          <span className="text-sm text-gray-900">$ {data.agentRate.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Bonus</span>
          <span className="text-sm text-gray-900">
            $ {data.bonus > 0 ? data.bonus.toFixed(2) : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Total Pay in USD</span>
          <span className="text-sm font-medium text-gray-900">$ {data.totalPayUSD.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Current Exchange Rate</span>
          <span className="text-sm text-gray-900">
            {data.currentExchangeRate.toFixed(2)}
            <span className="ml-1 text-xs text-gray-400">(PHP / 1USD)</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Converted Pay in PHP</span>
          <span className="text-sm font-semibold text-blue-600">₱ {formatPHP(data.convertedPayPHP)}</span>
        </div>
      </div>

      {/* Deductions */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Deductions</p>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Transfer Fee</span>
          <span className="text-sm text-gray-900">₱ {data.deductions.transferFee.toFixed(2)}</span>
        </div>
      </div>

      <hr className="my-4 border-2 border-gray-300" />

      {/* Net Pay */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-gray-800">NET PAY</span>
        <span className="text-lg font-bold text-green-600">₱ {formatPHP(data.netPay)}</span>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs italic text-gray-400">
        — Please be advised that a transfer fee will be deducted for payments
        processed through bank transfer.
      </p>
    </div>
  );
}
