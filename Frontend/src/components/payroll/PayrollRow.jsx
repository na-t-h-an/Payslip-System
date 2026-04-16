import { formatPHP } from '../../utils/formatCurrency';

const fmtUSD = (n) =>
  '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Format a raw cell value for PHP dynamic columns
function fmtPhpCell(rawVal, col) {
  if (rawVal == null || rawVal === '') return '—';
  if (col.type === 'number') {
    const n = Number(String(rawVal).replace(/[₱$,\s]/g, ''));
    if (isNaN(n)) return String(rawVal);
    return col.currency ? `₱${formatPHP(n)}` : new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  }
  return String(rawVal);
}

export default function PayrollRow({ employee, index, rowNumber, currency = 'USD', onEdit, onPayslip, onDelete, selected, onToggle, phpColumns = [] }) {
  const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
  const isUSD = currency === 'USD';
  const fmtMain = (n) => isUSD ? fmtUSD(n) : `₱${formatPHP(n)}`;
  const customData = (() => { try { return JSON.parse(employee.customData || '{}'); } catch { return {}; } })();
  const isPhpDynamic = !isUSD && phpColumns.length > 0;

  return (
    <tr className={`${rowBg} hover:bg-blue-50 transition-colors group`}>
      <td className={`px-4 py-3 sticky left-0 z-10 ${rowBg} group-hover:bg-blue-50 transition-colors`} style={{ minWidth: 48 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(employee.id)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      <td className={`px-4 py-3 text-center text-sm text-gray-400 font-medium sticky z-10 ${rowBg} group-hover:bg-blue-50 transition-colors`} style={{ left: 48, minWidth: 48 }}>
        {rowNumber}
      </td>
      <td className={`px-4 py-3 sticky z-10 ${rowBg} group-hover:bg-blue-50 transition-colors`} style={{ left: 96, minWidth: 96 }}>
        {employee.sent ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-700">
            ✓ Sent
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-sm font-semibold text-gray-500">
            Pending
          </span>
        )}
      </td>
      <td className={`px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap sticky z-10 border-r border-gray-200 ${rowBg} group-hover:bg-blue-50 transition-colors`} style={{ left: 192 }}>{employee.name}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{employee.email}</td>
      {isPhpDynamic ? (
        // PHP dynamic: read all column values from customData using col.key
        <>
          {phpColumns.map(col => {
            const raw = customData[col.key] ?? (col.systemField ? employee[col.systemField] : null);
            return (
              <td key={col.key}
                className={`px-4 py-3 text-sm text-gray-700 whitespace-nowrap ${col.type === 'number' ? 'text-right' : ''}`}>
                {fmtPhpCell(raw, col)}
              </td>
            );
          })}
        </>
      ) : (
        // Fixed columns — non-PHP or PHP without column mappings
        <>
          <td className="px-4 py-3 text-sm text-right text-gray-700">{employee.totalHours.toFixed(2)}</td>
          <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtMain(employee.rate)}</td>
          <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtMain(employee.pay)}</td>
          <td className="px-4 py-3 text-sm text-right text-gray-700">
            {employee.bonus > 0 ? fmtMain(employee.bonus) : '—'}
          </td>
          <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtMain(employee.totalPay)}</td>
          {isUSD && (
            <>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtUSD(employee.exchangeRate)}</td>
              <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                ₱{formatPHP(employee.totalPhpPay)}
              </td>
            </>
          )}
          <td className="px-4 py-3 text-sm text-right text-gray-700">
            {employee.transferFee > 0 ? `₱${formatPHP(employee.transferFee)}` : '—'}
          </td>
          <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
            ₱{formatPHP(employee.netPay)}
          </td>
          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{employee.bankName || '—'}</td>
          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{employee.accountNumber || '—'}</td>
        </>
      )}
      <td className="px-4 py-3 text-center">
        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={() => onEdit(employee)}
            title="Edit"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => onPayslip(employee)}
            title="Payslip"
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Payslip
          </button>
          <button
            onClick={() => onDelete(employee)}
            title="Delete"
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-600 shadow-sm transition-colors hover:border-red-400 hover:bg-red-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
