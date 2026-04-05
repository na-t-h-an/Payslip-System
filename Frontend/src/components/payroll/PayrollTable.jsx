import { useState, useMemo } from 'react';
import { getPayrollColumns } from '../../constants/payroll';
import PayrollRow from './PayrollRow';

export default function PayrollTable({ employees, currency = 'USD', onEdit, onPayslip, onDelete, selectedIds, onToggleSelect, onToggleSelectAll, onBulkSend, bulkSending, bulkProgress, onBulkDownload, bulkDownloading, bulkDownloadProgress, onBulkDelete, bulkError }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const isUSD = currency === 'USD';
  const columns = useMemo(() => getPayrollColumns(currency), [currency]);
  // checkbox + 3 (status/name/email colSpan) + data cols + actions
  const totalCols = 1 + columns.length + 1;

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filtered, sortKey, sortDir]);

  const sortIcon = (key) => {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const selectedCount = sorted.filter(e => selectedIds.has(e.id)).length;
  const allSelected = sorted.length > 0 && sorted.every(e => selectedIds.has(e.id));

  const fmtUSD = (n) => '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const fmtPHP = (n) => '₱' + new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const fmtMain = (n) => isUSD ? fmtUSD(n) : fmtPHP(n);

  const totals = useMemo(() => ({
    totalHours:      sorted.reduce((s, e) => s + (e.totalHours || 0), 0),
    rate:            sorted.reduce((s, e) => s + (e.rate || 0), 0),
    pay:             sorted.reduce((s, e) => s + (e.pay || 0), 0),
    bonus:           sorted.reduce((s, e) => s + (e.bonus || 0), 0),
    totalPay:        sorted.reduce((s, e) => s + (e.totalPay || 0), 0),
    totalPhpPay:     sorted.reduce((s, e) => s + (e.totalPhpPay || 0), 0),
    totalTransferFee:sorted.reduce((s, e) => s + (e.transferFee || 0), 0),
    totalNetPay:     sorted.reduce((s, e) => s + (e.netPay || 0), 0),
  }), [sorted]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <span style={{ borderBottom: '2px solid #6b7280' }} className="pb-0.5 text-sm font-medium text-gray-600">
          {sorted.length} employee{sorted.length !== 1 ? 's' : ''}
        </span>
        <div className="h-4 w-px bg-gray-300" />
        <button
          onClick={() => window.location.reload()}
          title="Refresh"
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
        {selectedCount > 0 && (
          <>
            <button
              onClick={() => onBulkSend(sorted.filter(e => selectedIds.has(e.id)))}
              disabled={bulkSending || bulkDownloading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {bulkSending ? `Sending ${bulkProgress}...` : `Send Selected (${selectedCount})`}
            </button>
            <button
              onClick={() => onBulkDownload(sorted.filter(e => selectedIds.has(e.id)))}
              disabled={bulkSending || bulkDownloading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {bulkDownloading ? `Generating ${bulkDownloadProgress}...` : `Download PDF (${selectedCount})`}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => onBulkDelete(sorted.filter(e => selectedIds.has(e.id)))}
              disabled={bulkSending || bulkDownloading}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Selected ({selectedCount})
            </button>
          </>
        )}
      </div>

      {bulkError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {bulkError}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 sticky top-0 z-10">
              <th className="whitespace-nowrap px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleSelectAll(sorted)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.accent ? 'text-blue-600' : 'text-gray-600'} hover:bg-gray-200 transition-colors`}
                >
                  {col.label} <span className="ml-0.5 text-gray-400">{sortIcon(col.key)}</span>
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((emp, i) => (
              <PayrollRow
                key={emp.id}
                employee={emp}
                index={i}
                currency={currency}
                onEdit={onEdit}
                onPayslip={onPayslip}
                onDelete={onDelete}
                selected={selectedIds.has(emp.id)}
                onToggle={onToggleSelect}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={totalCols} className="px-3 py-8 text-center text-sm text-gray-400">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="bg-gray-200 border-t-2 border-gray-400">
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-700" colSpan={3}>
                  Grand Total
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-800">
                  {totals.totalHours.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-800">
                  {fmtMain(totals.rate)}
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-800">
                  {fmtMain(totals.pay)}
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-800">
                  {totals.bonus > 0 ? fmtMain(totals.bonus) : '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-800">
                  {fmtMain(totals.totalPay)}
                </td>
                {isUSD && (
                  <>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-sm text-right font-bold text-blue-700">
                      {fmtPHP(totals.totalPhpPay)}
                    </td>
                  </>
                )}
                <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-800">
                  {totals.totalTransferFee > 0 ? fmtPHP(totals.totalTransferFee) : '—'}
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-blue-700">
                  {fmtPHP(totals.totalNetPay)}
                </td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
