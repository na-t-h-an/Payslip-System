import { useState, useEffect, useMemo } from 'react';
import {
  fetchCompanies,
  fetchEmployees,
  fetchLatestPayPeriod,
  fetchPayPeriodConfig,
  savePayPeriodConfig,
  deleteEmployee,
  deleteCompany,
  fetchSentStatus,
  generatePayslip,
  sendPayslipEmail,
} from '../services/api';
import { buildPayslipPDF, getInitials } from '../utils/buildPayslipPDF';
import { supabase } from '../supabaseClient';
import PayrollTable from '../components/payroll/PayrollTable';
import PageHeader from '../components/shared/PageHeader';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmployeeModal from '../components/payroll/EmployeeModal';
import PayslipModal from '../components/payslip/PayslipModal';
import CompanyTabs from '../components/company/CompanyTabs';
import AddCompanyModal from '../components/company/AddCompanyModal';
import ImportExcelModal from '../components/payroll/ImportExcelModal';

function formatInputDate(val) {
  if (!val) return '';
  const d = new Date(val + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildPeriodString(from, to) {
  const f = formatInputDate(from);
  const t = formatInputDate(to);
  if (!f || !t) return '';
  return `${f} to ${t}`;
}

export default function PayrollPage() {
  // ── Current user ──────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUser(session.user);
    });
  }, []);

  const userName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || '';
  const userEmail = currentUser?.email || '';
  const userInitials = userName
    .trim().split(/\s+/)
    .map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  // ── Companies ─────────────────────────────────────────────────────
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);

  useEffect(() => {
    fetchCompanies()
      .then(res => {
        setCompanies(res.data);
        if (res.data.length > 0) setSelectedCompany(res.data[0]);
      })
      .catch(() => {});
  }, []);

  const handleCompanyCreated = (company) => {
    setCompanies(prev => [...prev, company]);
    setSelectedCompany(company);
  };

  // ── Pay period config ─────────────────────────────────────────────
  const [config, setConfig] = useState({ payPeriod: '', exchangeRate: 0, transferFee: 0 });
  const [configEditing, setConfigEditing] = useState(true);
  const [configDraft, setConfigDraft] = useState({
    payPeriodFrom: '', payPeriodTo: '', exchangeRate: '', transferFee: ''
  });
  const [configSaving, setConfigSaving] = useState(false);

  // Reload pay period when company changes
  useEffect(() => {
    if (!selectedCompany) return;
    setConfig({ payPeriod: '', exchangeRate: 0, transferFee: 0 });
    setConfigEditing(true);
    fetchLatestPayPeriod(selectedCompany.id)
      .then(res => {
        const { id, startDate, endDate, exchangeRate, transferFee } = res.data;
        setConfig({ id, payPeriod: buildPeriodString(startDate, endDate), exchangeRate, transferFee });
        setConfigEditing(false);
      })
      .catch(() => {}); // No period yet — stay in edit mode
  }, [selectedCompany]);

  // Auto-load saved config when both dates are picked
  useEffect(() => {
    if (!configDraft.payPeriodFrom || !configDraft.payPeriodTo || !selectedCompany) return;
    fetchPayPeriodConfig(configDraft.payPeriodFrom, configDraft.payPeriodTo, selectedCompany.id)
      .then(res => {
        setConfigDraft(d => ({
          ...d,
          exchangeRate: res.data.exchangeRate ?? '',
          transferFee: res.data.transferFee ?? '',
        }));
      })
      .catch(() => {});
  }, [configDraft.payPeriodFrom, configDraft.payPeriodTo, selectedCompany]);

  const handleConfigEdit = () => {
    const [from, to] = config.payPeriod
      ? config.payPeriod.split(' to ').map(s => {
          const d = new Date(s.trim());
          return isNaN(d) ? '' : d.toISOString().slice(0, 10);
        })
      : ['', ''];
    setConfigDraft({
      payPeriodFrom: from ?? '',
      payPeriodTo: to ?? '',
      exchangeRate: config.exchangeRate || '',
      transferFee: config.transferFee || '',
    });
    setConfigEditing(true);
  };

  const handleConfigSave = async () => {
    if (!selectedCompany) return;
    const payPeriod = buildPeriodString(configDraft.payPeriodFrom, configDraft.payPeriodTo);
    const exchangeRate = parseFloat(configDraft.exchangeRate) || 0;
    const transferFee = parseFloat(configDraft.transferFee) || 0;

    setConfigSaving(true);
    let savedId;
    try {
      const res = await savePayPeriodConfig({
        companyId: selectedCompany.id,
        startDate: configDraft.payPeriodFrom,
        endDate: configDraft.payPeriodTo,
        exchangeRate,
        transferFee,
      });
      savedId = res.data?.id;
    } catch {
      // Non-fatal
    } finally {
      setConfigSaving(false);
    }

    setConfig({ id: savedId, payPeriod, exchangeRate, transferFee });
    setConfigEditing(false);
  };

  const handleConfigCancel = () => {
    if (!config.payPeriod) return;
    setConfigEditing(false);
  };

  // ── Sent status ───────────────────────────────────────────────────
  const [sentIds, setSentIds] = useState(new Set());

  useEffect(() => {
    if (!config.id) return;
    fetchSentStatus(config.id)
      .then(res => setSentIds(new Set(res.data)))
      .catch(() => {});
  }, [config.id]);

  // Reset sent status when company changes
  useEffect(() => {
    setSentIds(new Set());
  }, [selectedCompany]);

  const handlePayslipSent = (employeeId) => {
    setSentIds(prev => new Set([...prev, employeeId]));
  };

  // ── Bulk send ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedCompany]);

  const handleToggleSelect = (empId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId); else next.add(empId);
      return next;
    });
  };

  const handleToggleSelectAll = (visibleEmployees) => {
    const allSelected = visibleEmployees.every(e => selectedIds.has(e.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) visibleEmployees.forEach(e => next.delete(e.id));
      else visibleEmployees.forEach(e => next.add(e.id));
      return next;
    });
  };

  const handleBulkSend = async (selectedEmployees) => {
    if (!config.id) { alert('Please save a pay period before sending payslips.'); return; }

    const noAccount = selectedEmployees.filter(e => !e.accountNumber);
    const toSend = selectedEmployees.filter(e => e.accountNumber);

    if (noAccount.length > 0 && toSend.length === 0) {
      alert(`Cannot send — none of the selected employees have an account number.\n\nPlease edit each employee to add one.`);
      return;
    }
    if (noAccount.length > 0) {
      const names = noAccount.map(e => e.name).join('\n');
      const proceed = window.confirm(`${noAccount.length} employee(s) have no account number and will be skipped:\n\n${names}\n\nProceed for the remaining ${toSend.length}?`);
      if (!proceed) return;
    }

    setBulkSending(true);
    const failed = [];
    for (let i = 0; i < toSend.length; i++) {
      const emp = toSend[i];
      setBulkProgress(`${i + 1}/${toSend.length}`);
      try {
        const bonus = emp.bonus || 0;
        const totalPayUSD = emp.totalPay;
        const convertedPayPHP = totalPayUSD * config.exchangeRate;
        const netPay = convertedPayPHP - config.transferFee;
        const companyName = selectedCompany?.name || 'Company';

        await generatePayslip({
          employeeId: emp.id, payPeriodId: config.id,
          totalHours: emp.totalHours, rate: emp.rate, bonus, totalPhpPay: convertedPayPHP,
        });

        const pdfBlob = await buildPayslipPDF({
          companyName, companyInitials: getInitials(companyName),
          payTo: emp.name, payPeriod: config.payPeriod, emailAddress: emp.email,
          hoursWorked: emp.totalHours, agentRate: emp.rate, bonus,
          totalPayUSD, currentExchangeRate: config.exchangeRate, convertedPayPHP,
          deductions: { transferFee: config.transferFee }, netPay,
        });

        const formData = new FormData();
        formData.append('pdf', pdfBlob, `Payslip_${emp.name.replace(/\s+/g, '_')}.pdf`);
        formData.append('email', emp.email);
        formData.append('name', emp.name);
        formData.append('payPeriod', config.payPeriod);
        formData.append('employeeId', emp.id);
        formData.append('payPeriodId', config.id);

        await sendPayslipEmail(formData);
        handlePayslipSent(emp.id);
      } catch {
        failed.push(emp.name);
      }
    }
    setBulkSending(false);
    setBulkProgress('');
    setSelectedIds(new Set());
    if (failed.length > 0) alert(`Failed to send payslip for:\n${failed.join('\n')}`);
  };

  // ── Employees ─────────────────────────────────────────────────────
  const [rawEmployees, setRawEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reload employees when company changes
  useEffect(() => {
    if (!selectedCompany) return;
    setLoading(true);
    setError(null);
    fetchEmployees(selectedCompany.id)
      .then(res => setRawEmployees(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load employees'))
      .finally(() => setLoading(false));
  }, [selectedCompany]);

  const employees = useMemo(() =>
    rawEmployees.map(emp => ({
      ...emp,
      exchangeRate: config.exchangeRate || 0,
      totalPhpPay: (emp.totalPay || 0) * (config.exchangeRate || 0),
      sent: sentIds.has(emp.id),
    })),
  [rawEmployees, config.exchangeRate, sentIds]);

  // ── Modals ────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [payslipEmployee, setPayslipEmployee] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const handleImported = () => {
    if (!selectedCompany) return;
    fetchEmployees(selectedCompany.id)
      .then(res => setRawEmployees(res.data))
      .catch(() => {});
  };

  const handleDeleteEmployee = async (emp) => {
    if (!window.confirm(`Delete "${emp.name}"? This cannot be undone.`)) return;
    try {
      await deleteEmployee(emp.id);
      setRawEmployees(prev => prev.filter(e => e.id !== emp.id));
    } catch {
      alert('Failed to delete employee. Please try again.');
    }
  };

  const handleDeleteCompany = async (company) => {
    if (!window.confirm(`⚠️ Delete "${company.name}"?\n\nThis will permanently delete the company and all its employees. This cannot be undone.`)) return;
    try {
      await deleteCompany(company.id);
      const updated = companies.filter(c => c.id !== company.id);
      setCompanies(updated);
      setSelectedCompany(updated.length > 0 ? updated[0] : null);
    } catch {
      alert('Failed to delete company. Please try again.');
    }
  };

  const handleOpenAdd = () => { setEditingEmployee(null); setModalOpen(true); };
  const handleOpenEdit = (emp) => { setEditingEmployee(emp); setModalOpen(true); };

  const handleSave = (saved) => {
    setRawEmployees(prev => {
      const exists = prev.some(e => e.id === saved.id);
      return exists
        ? prev.map(e => (e.id === saved.id ? saved : e))
        : [...prev, saved];
    });
    setModalOpen(false);
  };

  return (
    <div>
      {/* ── User Profile ── */}
      {currentUser && (
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {userInitials}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">{userEmail}</p>
          </div>
        </div>
      )}

      <PageHeader title="Payroll Report" company={selectedCompany} />

      {/* ── Company Tabs ── */}
      <CompanyTabs
        companies={companies}
        selectedId={selectedCompany?.id}
        onSelect={(company) => setSelectedCompany(company)}
        onAddClick={() => setAddCompanyOpen(true)}
        onDelete={handleDeleteCompany}
      />

      {/* ── Config Banner ── */}
      {selectedCompany && (
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 px-6 py-4">
          {configEditing ? (
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-yellow-700">Pay Period</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={configDraft.payPeriodFrom}
                    onChange={e => setConfigDraft(d => ({ ...d, payPeriodFrom: e.target.value }))}
                    className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                  <span className="text-sm font-medium text-yellow-700">to</span>
                  <input
                    type="date"
                    value={configDraft.payPeriodTo}
                    onChange={e => setConfigDraft(d => ({ ...d, payPeriodTo: e.target.value }))}
                    className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-yellow-700">Exchange Rate</label>
                <input
                  type="number" step="0.01" min="0"
                  value={configDraft.exchangeRate}
                  onChange={e => setConfigDraft(d => ({ ...d, exchangeRate: e.target.value }))}
                  className="w-28 rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-yellow-700">Transfer Fee (₱)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={configDraft.transferFee}
                  onChange={e => setConfigDraft(d => ({ ...d, transferFee: e.target.value }))}
                  className="w-28 rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                />
              </div>
              <div className="flex gap-2 pb-0.5">
                <button
                  onClick={handleConfigSave}
                  disabled={configSaving || !configDraft.payPeriodFrom || !configDraft.payPeriodTo}
                  className="rounded-md bg-yellow-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                >
                  {configSaving ? 'Saving...' : 'Save'}
                </button>
                {config.payPeriod && (
                  <button
                    onClick={handleConfigCancel}
                    className="rounded-md border border-yellow-300 bg-white px-4 py-1.5 text-sm text-gray-600 hover:bg-yellow-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
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

      {/* ── Table ── */}
      {!selectedCompany && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
          Add or select a company to view its payroll report.
        </div>
      )}
      {selectedCompany && loading && <LoadingSpinner />}
      {selectedCompany && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {selectedCompany && !loading && (
        <>
          <div className="mb-3 flex justify-end">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import from Excel
            </button>
          </div>
          <PayrollTable
            employees={employees}
            onEdit={handleOpenEdit}
            onPayslip={setPayslipEmployee}
            onDelete={handleDeleteEmployee}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onBulkSend={handleBulkSend}
            bulkSending={bulkSending}
            bulkProgress={bulkProgress}
          />
        </>
      )}

      {/* ── FAB — Add Employee ── */}
      {selectedCompany && (
        <button
          onClick={handleOpenAdd}
          title="Add Employee"
          className="print:hidden fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* ── Modals ── */}
      {addCompanyOpen && (
        <AddCompanyModal
          onCreated={handleCompanyCreated}
          onClose={() => setAddCompanyOpen(false)}
        />
      )}
      {importOpen && (
        <ImportExcelModal
          companyId={selectedCompany?.id}
          onImported={handleImported}
          onClose={() => setImportOpen(false)}
        />
      )}
      {modalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          companyId={selectedCompany?.id}
          exchangeRate={config.exchangeRate}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
      {payslipEmployee && (
        <PayslipModal
          employee={payslipEmployee}
          config={config}
          company={selectedCompany}
          alreadySent={payslipEmployee.sent}
          onSent={() => handlePayslipSent(payslipEmployee.id)}
          onClose={() => setPayslipEmployee(null)}
        />
      )}
    </div>
  );
}
