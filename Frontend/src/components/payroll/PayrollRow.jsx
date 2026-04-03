import { formatPHP } from '../../utils/formatCurrency';

export default function PayrollRow({ employee, index, onEdit }) {
  const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

  return (
    <tr className={`${rowBg} hover:bg-blue-50 transition-colors`}>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{employee.name}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{employee.email}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-700">{employee.totalHours.toFixed(2)}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-700">${employee.rate.toFixed(2)}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-700">{employee.pay.toFixed(2)}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-700">
        {employee.bonus > 0 ? employee.bonus.toFixed(2) : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-right text-gray-700">{employee.totalPay.toFixed(2)}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-700">{employee.exchangeRate.toFixed(2)}</td>
      <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
        ₱{formatPHP(employee.totalPhpPay)}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onEdit(employee)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
      </td>
    </tr>
  );
}
