import { useState, useMemo } from 'react';
import { PAYROLL_COLUMNS } from '../../constants/payroll';
import PayrollRow from './PayrollRow';

export default function PayrollTable({ employees, onEdit, onPayslip, onDelete, selectedIds, onToggleSelect, onToggleSelectAll, onBulkSend, bulkSending, bulkProgress }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

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
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
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
        <span className="text-sm text-gray-500">{sorted.length} employee{sorted.length !== 1 ? 's' : ''}</span>
        {selectedCount > 0 && (
          <button
            onClick={() => onBulkSend(sorted.filter(e => selectedIds.has(e.id)))}
            disabled={bulkSending}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {bulkSending ? `Sending ${bulkProgress}...` : `Send Selected (${selectedCount})`}
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 sticky top-0 z-10">
              <th className="whitespace-nowrap px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleSelectAll(sorted)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              {PAYROLL_COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.accent ? 'text-blue-600' : 'text-gray-600'} hover:bg-gray-200 transition-colors`}
                >
                  {col.label} <span className="ml-1 text-gray-400">{sortIcon(col.key)}</span>
                </th>
              ))}
              <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
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
                onEdit={onEdit}
                onPayslip={onPayslip}
                onDelete={onDelete}
                selected={selectedIds.has(emp.id)}
                onToggle={onToggleSelect}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-gray-400">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
