import { formatPHP } from '../../utils/formatCurrency';

export default function PayslipPreview({ data }) {
  const isUSD = (data.currency || 'USD') === 'USD';
  const fmtUSD = (n) => '$ ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const fmtMain = (n) => isUSD ? fmtUSD(n) : `₱ ${formatPHP(n)}`;

  const Row = ({ label, value, bold, color }) => (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold' : ''} ${color || 'text-gray-900'}`}>{value}</span>
    </div>
  );

  return (
    <div className="payslip-card rounded-lg border border-gray-200 bg-white p-8 shadow-md" id="payslip-print-area">
      {/* Header */}
      <div className="mb-6 text-center">
        <img src="/icon.ico" alt="Logo" className="mx-auto mb-2 h-16 w-auto object-contain" />
        <p className="text-xs text-gray-400">Payslip</p>
      </div>

      {/* Recipient Info */}
      <div className="mb-4 space-y-2">
        <Row label="Pay to:" value={data.payTo} />
        <Row label="Pay Period:" value={data.payPeriod} />
        <Row label="Email Address:" value={data.emailAddress} />
      </div>

      <hr className="my-4 border-gray-200" />

      {/* Earnings */}
      <div className="mb-4 space-y-2">
        {data.dynamicColumns ? (
          // PHP dynamic mode — pair consecutive same-type columns into 2-col rows
          (() => {
            const out = [];
            let i = 0;
            while (i < data.dynamicColumns.length) {
              const col  = data.dynamicColumns[i];
              const next = data.dynamicColumns[i + 1];
              const pair = next && col.isNumber === next.isNumber;
              if (pair) {
                out.push(
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 truncate pr-1">{col.label}</span>
                      <span className={`text-sm shrink-0 ${col.isNumber ? 'font-medium' : ''} text-gray-900`}>{col.value}</span>
                    </div>
                    <div className="flex justify-between border-l border-gray-100 pl-3">
                      <span className="text-sm text-gray-500 truncate pr-1">{next.label}</span>
                      <span className={`text-sm shrink-0 ${next.isNumber ? 'font-medium' : ''} text-gray-900`}>{next.value}</span>
                    </div>
                  </div>
                );
                i += 2;
              } else {
                out.push(<Row key={i} label={col.label} value={col.value} bold={col.isNumber} />);
                i += 1;
              }
            }
            return out;
          })()
        ) : (
          // Standard fixed layout
          <>
            <Row label="Hours Worked" value={Number(data.hoursWorked).toFixed(2)} />
            <Row label="Agent Rate" value={fmtMain(data.agentRate)} />
            <Row label="Bonus" value={data.bonus > 0 ? fmtMain(data.bonus) : (isUSD ? '$ —' : '₱ —')} />
            {isUSD ? (
              <>
                <Row label="Total Pay in USD" value={fmtUSD(data.totalPayUSD)} bold />
                <Row label="Current Exchange Rate" value={`${Number(data.currentExchangeRate).toFixed(2)}`} />
                <Row label="Converted Pay in PHP" value={`₱ ${formatPHP(data.convertedPayPHP)}`} bold color="text-blue-600" />
              </>
            ) : (
              <Row label="Total Pay" value={`₱ ${formatPHP(data.totalPayUSD)}`} bold color="text-blue-600" />
            )}
          </>
        )}
      </div>

      {/* Deductions */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Deductions</p>
        <Row label="Transfer Fee" value={`₱ ${Number(data.deductions.transferFee).toFixed(2)}`} />
      </div>

      <hr className="my-4 border-2 border-gray-300" />

      {/* Net Pay */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-gray-800">NET PAY</span>
        <span className="text-lg font-bold text-green-600">₱ {formatPHP(data.netPay)}</span>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs italic text-gray-400">
        — This document serves as your official payslip and is system-generated; no signature is required.
        Transfer fees will be deducted for payments to non-BPI accounts. For any discrepancies, please contact your employer.
      </p>
    </div>
  );
}
