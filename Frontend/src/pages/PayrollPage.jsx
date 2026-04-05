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
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmployeeModal from '../components/payroll/EmployeeModal';
import PayslipModal from '../components/payslip/PayslipModal';
import CompanyTabs from '../components/company/CompanyTabs';
import AddCompanyModal from '../components/company/AddCompanyModal';
import ImportExcelModal from '../components/payroll/ImportExcelModal';
import EmailQuota from '../components/shared/EmailQuota';

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
  const [config, setConfig] = useState({ payPeriod: '', exchangeRate: 0 });
  const [configEditing, setConfigEditing] = useState(true);
  const [configDraft, setConfigDraft] = useState({
    payPeriodFrom: '', payPeriodTo: '', exchangeRate: ''
  });
  const [configSaving, setConfigSaving] = useState(false);

  // Reload pay period when company changes
  useEffect(() => {
    if (!selectedCompany) return;
    setConfig({ payPeriod: '', exchangeRate: 0, transferFee: 0 });
    setConfigEditing(true);
    fetchLatestPayPeriod(selectedCompany.id)
      .then(res => {
        const { id, startDate, endDate, exchangeRate } = res.data;
        setConfig({ id, payPeriod: buildPeriodString(startDate, endDate), exchangeRate, startDate, endDate });
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
    });
    setConfigEditing(true);
  };

  const [showResetWarning, setShowResetWarning] = useState(false);

  const doConfigSave = async () => {
    if (!selectedCompany) return;
    const payPeriod = buildPeriodString(configDraft.payPeriodFrom, configDraft.payPeriodTo);
    const exchangeRate = parseFloat(configDraft.exchangeRate) || 0;

    setConfigSaving(true);
    let savedId;
    try {
      const res = await savePayPeriodConfig({
        companyId: selectedCompany.id,
        startDate: configDraft.payPeriodFrom,
        endDate: configDraft.payPeriodTo,
        exchangeRate,
      });
      savedId = res.data?.id;
    } catch {
      // Non-fatal
    } finally {
      setConfigSaving(false);
    }

    setConfig({ id: savedId, payPeriod, exchangeRate, startDate: configDraft.payPeriodFrom, endDate: configDraft.payPeriodTo });
    setConfigEditing(false);
  };

  const handleConfigSave = async () => {
    if (!selectedCompany) return;

    // Detect if the month/year changed from the current saved period
    if (config.payPeriod && sentIds.size > 0 && configDraft.payPeriodFrom) {
      const currentStart = new Date(config.payPeriod.split(' to ')[0]);
      const newStart = new Date(configDraft.payPeriodFrom + 'T00:00:00');
      const monthChanged =
        currentStart.getMonth() !== newStart.getMonth() ||
        currentStart.getFullYear() !== newStart.getFullYear();
      if (monthChanged) {
        setShowResetWarning(true);
        return;
      }
    }

    await doConfigSave();
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
  const [bulkError, setBulkError] = useState('');

  const showBulkError = (msg) => {
    setBulkError(msg);
    setTimeout(() => setBulkError(''), 5000);
  };

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
    if (!config.id) { showBulkError('Please save a pay period before sending payslips.'); return; }

    const noAccount = selectedEmployees.filter(e => !e.accountNumber);
    const toSend = selectedEmployees.filter(e => e.accountNumber);

    if (noAccount.length > 0 && toSend.length === 0) {
      showBulkError('Cannot send — none of the selected employees have an account number. Please edit each employee to add one.');
      return;
    }
    if (noAccount.length > 0) {
      showBulkError(`${noAccount.length} employee(s) skipped (no account number): ${noAccount.map(e => e.name).join(', ')}`);
    }

    setBulkSending(true);
    const failed = [];
    for (let i = 0; i < toSend.length; i++) {
      const emp = toSend[i];
      setBulkProgress(`${i + 1}/${toSend.length}`);
      try {
        const bonus = emp.bonus || 0;
        const totalPayUSD = emp.totalPay;
        const convertedPayPHP = currency === 'PHP' ? totalPayUSD : totalPayUSD * config.exchangeRate;
        const netPay = convertedPayPHP - (emp.transferFee || 0);
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
          deductions: { transferFee: emp.transferFee || 0 }, netPay,
          currency,
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
    if (failed.length > 0) showBulkError(`Failed to send payslip for: ${failed.join(', ')}`);
  };

  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDownloadProgress, setBulkDownloadProgress] = useState('');

  const handleBulkDownload = async (selectedEmployees) => {
    if (!config.id) { showBulkError('Please save a pay period before downloading payslips.'); return; }

    setBulkDownloading(true);
    const files = [];
    const failed = [];

    for (let i = 0; i < selectedEmployees.length; i++) {
      const emp = selectedEmployees[i];
      setBulkDownloadProgress(`${i + 1}/${selectedEmployees.length}`);
      try {
        const bonus = emp.bonus || 0;
        const totalPayUSD = emp.totalPay;
        const convertedPayPHP = currency === 'PHP' ? totalPayUSD : totalPayUSD * config.exchangeRate;
        const netPay = convertedPayPHP - (emp.transferFee || 0);
        const companyName = selectedCompany?.name || 'Company';

        const pdfBlob = await buildPayslipPDF({
          companyName, companyInitials: getInitials(companyName),
          payTo: emp.name, payPeriod: config.payPeriod, emailAddress: emp.email,
          hoursWorked: emp.totalHours, agentRate: emp.rate, bonus,
          totalPayUSD, currentExchangeRate: config.exchangeRate, convertedPayPHP,
          deductions: { transferFee: emp.transferFee || 0 }, netPay,
          currency,
        });

        const arrayBuffer = await pdfBlob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let j = 0; j < uint8.length; j += chunkSize) {
          binary += String.fromCharCode(...uint8.subarray(j, j + chunkSize));
        }
        const base64 = btoa(binary);
        files.push({
          name: `Payslip_${emp.name.replace(/\s+/g, '_')}.pdf`,
          data: base64,
        });
      } catch {
        failed.push(emp.name);
      }
    }

    setBulkDownloading(false);
    setBulkDownloadProgress('');

    if (files.length === 0) { showBulkError('Failed to generate any PDFs.'); return; }

    if (window.electronAPI?.savePdfsToFolder) {
      // Electron: native folder picker via IPC
      const result = await window.electronAPI.savePdfsToFolder(files);
      if (!result.canceled && result.failed?.length > 0) {
        showBulkError(`Saved to folder. Failed to write: ${result.failed.join(', ')}`);
      }
    } else if (typeof window.showDirectoryPicker === 'function') {
      // Browser (Chrome/Edge): File System Access API folder picker
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const writeFailed = [];
        for (const file of files) {
          try {
            const fileHandle = await dirHandle.getFileHandle(file.name, { create: true });
            const writable = await fileHandle.createWritable();
            const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
            await writable.write(bytes);
            await writable.close();
          } catch {
            writeFailed.push(file.name);
          }
        }
        if (writeFailed.length > 0) showBulkError(`Failed to save: ${writeFailed.join(', ')}`);
      } catch (err) {
        if (err.name !== 'AbortError') showBulkError('Could not access the selected folder.');
      }
    } else {
      // Fallback: individual browser downloads
      for (const file of files) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${file.data}`;
        link.download = file.name;
        link.click();
      }
    }

    if (failed.length > 0) showBulkError(`Failed to generate PDF for: ${failed.join(', ')}`);
  };

  const handleBulkDelete = async (selectedEmployees) => {
    const names = selectedEmployees.map(e => e.name).join('\n');
    const confirmed = window.confirm(
      `Delete ${selectedEmployees.length} employee(s)? This cannot be undone.\n\n${names}`
    );
    if (!confirmed) return;

    const failed = [];
    for (const emp of selectedEmployees) {
      try {
        await deleteEmployee(emp.id);
        setRawEmployees(prev => prev.filter(e => e.id !== emp.id));
      } catch {
        failed.push(emp.name);
      }
    }
    setSelectedIds(new Set());
    if (failed.length > 0) alert(`Failed to delete:\n${failed.join('\n')}`);
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


  const currency = selectedCompany?.currency || 'USD';

  const employees = useMemo(() => {
    const isUSD = currency === 'USD';
    return rawEmployees.map(emp => {
      const totalPhpPay = isUSD
        ? (emp.totalPay || 0) * (config.exchangeRate || 0)
        : (emp.totalPay || 0);
      const transferFee = emp.transferFee || 0;
      return {
        ...emp,
        exchangeRate: config.exchangeRate || 0,
        totalPhpPay,
        netPay: totalPhpPay - transferFee,
        sent: sentIds.has(emp.id),
      };
    });
  }, [rawEmployees, config.exchangeRate, sentIds, currency]);

  // ── Modals ────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [payslipEmployee, setPayslipEmployee] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const handleImported = (importedExchangeRate) => {
    if (!selectedCompany) return;
    fetchEmployees(selectedCompany.id)
      .then(res => setRawEmployees(res.data))
      .catch(() => {});
    // If the Excel had an exchange rate column, overwrite the current pay period rate
    if (importedExchangeRate && config.startDate && config.endDate) {
      savePayPeriodConfig({
        companyId: selectedCompany.id,
        startDate: config.startDate,
        endDate: config.endDate,
        exchangeRate: importedExchangeRate,
      })
        .then(() => {
          setConfig(prev => ({ ...prev, exchangeRate: importedExchangeRate }));
        })
        .catch(() => {});
    }
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
      {/* ── Page Header + User Profile ── */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          {userInitials || '?'}
        </div>
        <div className="leading-tight">
          <p className="text-xl font-bold text-gray-900">Payroll Report</p>
          {currentUser && (
            <p className="text-sm text-gray-500">
              {userName} · {userEmail}
            </p>
          )}
        </div>
        <div className="ml-auto">
          <EmailQuota />
        </div>
      </div>

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
              {currency === 'USD' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-yellow-700">Exchange Rate</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={configDraft.exchangeRate}
                    onChange={e => setConfigDraft(d => ({ ...d, exchangeRate: e.target.value }))}
                    className="w-28 rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </div>
              )}
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
              <button
                onClick={handleConfigEdit}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <span className="text-sm text-gray-700">
                Pay Period: <strong className="text-gray-900">{config.payPeriod}</strong>
              </span>
              {currency === 'USD' && (
                <span className="text-sm text-gray-700">
                  Exchange Rate: <strong className="text-gray-900">{config.exchangeRate}</strong>
                </span>
              )}
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
          <div className="mb-5 flex justify-start">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-base font-medium text-blue-700 hover:bg-blue-100 transition-colors"
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
            currency={currency}
            onEdit={handleOpenEdit}
            onPayslip={setPayslipEmployee}
            onDelete={handleDeleteEmployee}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onBulkSend={handleBulkSend}
            bulkSending={bulkSending}
            bulkProgress={bulkProgress}
            onBulkDownload={handleBulkDownload}
            bulkDownloading={bulkDownloading}
            bulkDownloadProgress={bulkDownloadProgress}
            onBulkDelete={handleBulkDelete}
            bulkError={bulkError}
          />
        </>
      )}

      {/* ── FAB — Add Employee ── */}
      {selectedCompany && (
        <button
          onClick={handleOpenAdd}
          className="print:hidden fixed bottom-8 right-8 flex items-center gap-2 rounded-full bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </button>
      )}

      {/* ── Reset Warning Modal ── */}
      {showResetWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Reset employee statuses?</p>
                <p className="text-xs text-gray-500 mt-0.5">You're switching to a different month.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              All <strong>{sentIds.size}</strong> employee{sentIds.size !== 1 ? 's' : ''} currently marked as <span className="font-medium text-green-600">Sent</span> will be reset to <span className="font-medium text-gray-500">Pending</span> for the new pay period.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetWarning(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowResetWarning(false); doConfigSave(); }}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                Yes, Reset & Save
              </button>
            </div>
          </div>
        </div>
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
          currency={currency}
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
          currency={currency}
          alreadySent={payslipEmployee.sent}
          onSent={() => handlePayslipSent(payslipEmployee.id)}
          onClose={() => setPayslipEmployee(null)}
        />
      )}
    </div>
  );
}
