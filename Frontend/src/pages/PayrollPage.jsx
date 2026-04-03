import { useState, useEffect } from 'react';
import { usePayroll } from '../hooks/usePayroll';
import { DEFAULT_PAY_PERIOD, DEFAULT_EXCHANGE_RATE, DEFAULT_TRANSFER_FEE } from '../constants/payroll';
import PayrollTable from '../components/payroll/PayrollTable';
import PageHeader from '../components/shared/PageHeader';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmployeeModal from '../components/payroll/EmployeeModal';
import PayslipModal from '../components/payslip/PayslipModal';

// "March 15, 2026 to March 28, 2026" → { from: '2026-03-15', to: '2026-03-28' }
function parsePeriod(str) {
  const parts = str.split(' to ');
  const toInputDate = (s) => {
    const d = new Date(s.trim());
    if (isNaN(d)) return '';
    return d.toISOString().slice(0, 10);
  };
  return { from: toInputDate(parts[0]), to: toInputDate(parts[1] ?? '') };
}

// '2026-03-15' → "March 15, 2026"
function formatInputDate(val) {
  if (!val) return '';
  const d = new Date(val + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// { from, to } → "March 15, 2026 to March 28, 2026"
function buildPeriodString(from, to) {
  const f = formatInputDate(from);
  const t = formatInputDate(to);
  if (!f || !t) return `${f || '?'} to ${t || '?'}`;
  return `${f} to ${t}`;
}

export default function PayrollPage() {
  const [payPeriod] = useState(DEFAULT_PAY_PERIOD);
  const { data, loading, error } = usePayroll(payPeriod);

  // Editable config state — seeded from fetched/mock data
  const [config, setConfig] = useState({
    payPeriod: DEFAULT_PAY_PERIOD,
    exchangeRate: DEFAULT_EXCHANGE_RATE,
    transferFee: DEFAULT_TRANSFER_FEE,
  });
  const [configEditing, setConfigEditing] = useState(false);
  const [configDraft, setConfigDraft] = useState({ ...config, payPeriodFrom: '', payPeriodTo: '' });

  useEffect(() => {
    if (data?.config) {
      setConfig(data.config);
      setConfigDraft(data.config);
    }
  }, [data]);

  const handleConfigEdit = () => {
    const { from, to } = parsePeriod(config.payPeriod);
    setConfigDraft({ ...config, payPeriodFrom: from, payPeriodTo: to });
    setConfigEditing(true);
  };

  const handleConfigSave = () => {
    const saved = {
      payPeriod: buildPeriodString(configDraft.payPeriodFrom, configDraft.payPeriodTo),
      exchangeRate: parseFloat(configDraft.exchangeRate) || DEFAULT_EXCHANGE_RATE,
      transferFee: parseFloat(configDraft.transferFee) || DEFAULT_TRANSFER_FEE,
    };
    setConfig(saved);
    // Recalculate PHP pay for all employees with the new exchange rate
    setEmployees(prev =>
      prev.map(emp => ({
        ...emp,
        exchangeRate: saved.exchangeRate,
        totalPhpPay: emp.totalPay * saved.exchangeRate,
      }))
    );
    setConfigEditing(false);
  };

  const handleConfigCancel = () => setConfigEditing(false);

  // Local employee list — seeded from fetched/mock data
  const [employees, setEmployees] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [payslipEmployee, setPayslipEmployee] = useState(null);

  useEffect(() => {
    if (data?.employees) setEmployees(data.employees);
  }, [data]);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (employee) => {
    setEditingEmployee(employee);
    setModalOpen(true);
  };

  const handleSave = (saved) => {
    setEmployees(prev => {
      const exists = prev.some(e => e.id === saved.id);
      return exists
        ? prev.map(e => (e.id === saved.id ? saved : e))
        : [...prev, saved];
    });
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader title="Payroll Report" />

      {/* Config Banner */}
      {(data || !loading) && (
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 px-6 py-4">
          {configEditing ? (
            /* Edit mode */
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-yellow-700">Pay Period</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={configDraft.payPeriodFrom ?? ''}
                    onChange={e => setConfigDraft(d => ({ ...d, payPeriodFrom: e.target.value }))}
                    className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                  <span className="text-sm text-yellow-700 font-medium">to</span>
                  <input
                    type="date"
                    value={configDraft.payPeriodTo ?? ''}
                    onChange={e => setConfigDraft(d => ({ ...d, payPeriodTo: e.target.value }))}
                    className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-yellow-700">Exchange Rate</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={configDraft.exchangeRate}
                  onChange={e => setConfigDraft(d => ({ ...d, exchangeRate: e.target.value }))}
                  className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200 w-28"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-yellow-700">Transfer Fee (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={configDraft.transferFee}
                  onChange={e => setConfigDraft(d => ({ ...d, transferFee: e.target.value }))}
                  className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200 w-28"
                />
              </div>
              <div className="flex gap-2 pb-0.5">
                <button
                  onClick={handleConfigSave}
                  className="rounded-md bg-yellow-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-yellow-600"
                >
                  Save
                </button>
                <button
                  onClick={handleConfigCancel}
                  className="rounded-md border border-yellow-300 bg-white px-4 py-1.5 text-sm text-gray-600 hover:bg-yellow-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <div className="flex flex-wrap items-center gap-6">
              <span className="text-sm text-gray-700">
                Pay Period: <strong className="text-gray-900">{config.payPeriod}</strong>
              </span>
              <span className="text-sm text-gray-700">
                Exchange Rate: <strong className="text-gray-900">{config.exchangeRate}</strong>
              </span>
              <span className="text-sm text-gray-700">
                Transfer Fee: <strong className="text-gray-900">₱{Number(config.transferFee).toFixed(2)}</strong>
              </span>
              <button
                onClick={handleConfigEdit}
                title="Edit config"
                className="ml-auto flex items-center gap-1.5 rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <LoadingSpinner />}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {!loading && (
        <PayrollTable employees={employees} onEdit={handleOpenEdit} onPayslip={setPayslipEmployee} />
      )}

      {/* FAB — Add Employee */}
      <button
        onClick={handleOpenAdd}
        title="Add Employee"
        className="print:hidden fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Employee add/edit modal */}
      {modalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          exchangeRate={config.exchangeRate}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Payslip modal */}
      {payslipEmployee && (
        <PayslipModal
          employee={payslipEmployee}
          config={config}
          onClose={() => setPayslipEmployee(null)}
        />
      )}
    </div>
  );
}
