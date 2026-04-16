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
import { formatPHP } from '../utils/formatCurrency';
import { supabase } from '../supabaseClient';
import PayrollTable from '../components/payroll/PayrollTable';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmployeeModal from '../components/payroll/EmployeeModal';
import PayslipModal from '../components/payslip/PayslipModal';
import CompanyTabs from '../components/company/CompanyTabs';
import AddCompanyModal from '../components/company/AddCompanyModal';
import ImportExcelModal from '../components/payroll/ImportExcelModal';
import ManageColumnsModal from '../components/company/ManageColumnsModal';
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

  // Reload pay period when company changes (depend on ID only — not the whole
  // object — so updating columnMappings on the same company doesn't re-trigger)
  useEffect(() => {
    if (!selectedCompany) return;
    setConfig({ payPeriod: '', exchangeRate: 0, transferFee: 0 });
    setConfigEditing(true);
    fetchLatestPayPeriod(selectedCompany.id)
      .then(res => {
        if (!res.data) return; // No period yet — stay in edit mode
        const { id, startDate, endDate, exchangeRate } = res.data;
        setConfig({ id, payPeriod: buildPeriodString(startDate, endDate), exchangeRate, startDate, endDate });
        setConfigEditing(false);
      })
      .catch(() => {}); // Stay in edit mode on error
  }, [selectedCompany?.id]);

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
    const datesChanged =
      configDraft.payPeriodFrom !== config.startDate ||
      configDraft.payPeriodTo !== config.endDate;

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

    // Only use the new savedId (which triggers a sentStatus refetch and resets
    // statuses) when the dates actually changed. If only the exchange rate
    // changed, keep the existing config.id so statuses are preserved.
    setConfig({
      id: datesChanged ? savedId : config.id,
      payPeriod, exchangeRate,
      startDate: configDraft.payPeriodFrom,
      endDate: configDraft.payPeriodTo,
    });
    setConfigEditing(false);
  };

  const handleConfigSave = async () => {
    if (!selectedCompany) return;

    // Show confirmation whenever dates change from the currently saved period
    if (config.payPeriod && configDraft.payPeriodFrom && configDraft.payPeriodTo) {
      const datesChanged =
        configDraft.payPeriodFrom !== config.startDate ||
        configDraft.payPeriodTo !== config.endDate;
      if (datesChanged) {
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
  const [bulkCurrentName, setBulkCurrentName] = useState('');
  const [bulkDoneCount, setBulkDoneCount] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkError, setBulkError] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(null); // holds toSend array when confirming

  // ── Company delete confirm ────────────────────────────────────────
  const [companyDeleteConfirm, setCompanyDeleteConfirm] = useState(null); // holds company object

  // ── Bulk delete ───────────────────────────────────────────────────
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(null); // holds selectedEmployees array
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteCurrentName, setBulkDeleteCurrentName] = useState('');
  const [bulkDeleteDoneCount, setBulkDeleteDoneCount] = useState(0);
  const [bulkDeleteTotal, setBulkDeleteTotal] = useState(0);

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

  const executeBulkSend = async (toSend) => {
    setBulkConfirm(null);
    // Refresh auth token before starting — bulk sends can take several minutes
    // and a stale token mid-loop causes 401 console errors.
    await supabase.auth.refreshSession();
    setBulkSending(true);
    setBulkTotal(toSend.length);
    setBulkDoneCount(0);
    const failed = [];
    for (let i = 0; i < toSend.length; i++) {
      const emp = toSend[i];
      setBulkDoneCount(i + 1);
      setBulkCurrentName(emp.name);
      setBulkProgress(`${i + 1}/${toSend.length}`);
      try {
        const bonus = emp.bonus || 0;
        const totalPayUSD = emp.totalPay;
        const convertedPayPHP = currency === 'PHP' ? totalPayUSD : totalPayUSD * config.exchangeRate;
        const { dynamicColumns, dynamicNetPay } = buildDynamicColumns(emp);
        const netPay = dynamicNetPay !== null ? dynamicNetPay : convertedPayPHP - (emp.transferFee || 0);
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
          dynamicColumns,
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
        if (i < toSend.length - 1) await new Promise(r => setTimeout(r, 1200));
      } catch {
        failed.push(emp.name);
      }
    }
    setBulkSending(false);
    setBulkProgress('');
    setBulkCurrentName('');
    setBulkDoneCount(0);
    setBulkTotal(0);
    setSelectedIds(new Set());
    if (failed.length > 0) showBulkError(`Failed to send payslip for: ${failed.join(', ')}`);
  };

  const handleBulkSend = (selectedEmployees) => {
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

    if (toSend.length > 5) {
      setBulkConfirm(toSend);
    } else {
      executeBulkSend(toSend);
    }
  };

  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDownloadProgress, setBulkDownloadProgress] = useState('');
  const [bulkDownloadCurrentName, setBulkDownloadCurrentName] = useState('');
  const [bulkDownloadDoneCount, setBulkDownloadDoneCount] = useState(0);
  const [bulkDownloadTotal, setBulkDownloadTotal] = useState(0);

  const handleBulkDownload = async (selectedEmployees) => {
    if (!config.id) { showBulkError('Please save a pay period before downloading payslips.'); return; }

    // Open the folder picker FIRST — must happen within the user gesture activation window
    // (Chrome expires activation after ~5s; generating many PDFs before calling the picker
    // causes a SecurityError for large selections)
    let dirHandle = null;
    if (!window.electronAPI?.savePdfsToFolder && typeof window.showDirectoryPicker === 'function') {
      try {
        dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled
        showBulkError('That folder is not accessible (it may be protected). Please try again and choose a different folder.');
        return;
      }
    }

    setBulkDownloading(true);
    setBulkDownloadDoneCount(0);
    setBulkDownloadTotal(selectedEmployees.length);
    const files = [];
    const failed = [];

    for (let i = 0; i < selectedEmployees.length; i++) {
      const emp = selectedEmployees[i];
      setBulkDownloadCurrentName(emp.name);
      setBulkDownloadProgress(`${i + 1}/${selectedEmployees.length}`);
      try {
        const bonus = emp.bonus || 0;
        const totalPayUSD = emp.totalPay;
        const convertedPayPHP = currency === 'PHP' ? totalPayUSD : totalPayUSD * config.exchangeRate;
        const { dynamicColumns, dynamicNetPay } = buildDynamicColumns(emp);
        const netPay = dynamicNetPay !== null ? dynamicNetPay : convertedPayPHP - (emp.transferFee || 0);
        const companyName = selectedCompany?.name || 'Company';

        const pdfBlob = await buildPayslipPDF({
          companyName, companyInitials: getInitials(companyName),
          payTo: emp.name, payPeriod: config.payPeriod, emailAddress: emp.email,
          hoursWorked: emp.totalHours, agentRate: emp.rate, bonus,
          totalPayUSD, currentExchangeRate: config.exchangeRate, convertedPayPHP,
          deductions: { transferFee: emp.transferFee || 0 }, netPay,
          currency,
          dynamicColumns,
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
        setBulkDownloadDoneCount(i + 1);
      } catch {
        failed.push(emp.name);
        setBulkDownloadDoneCount(i + 1);
      }
    }

    if (files.length === 0) {
      setBulkDownloading(false);
      setBulkDownloadProgress('');
      setBulkDownloadCurrentName('');
      setBulkDownloadDoneCount(0);
      setBulkDownloadTotal(0);
      showBulkError('Failed to generate any PDFs.');
      return;
    }

    if (window.electronAPI?.savePdfsToFolder) {
      // Deduplicate names within the batch before handing to Electron
      const nameCounts = {};
      const deduped = files.map(file => {
        const dotIdx = file.name.lastIndexOf('.');
        const base = dotIdx >= 0 ? file.name.slice(0, dotIdx) : file.name;
        const ext  = dotIdx >= 0 ? file.name.slice(dotIdx) : '';
        if (!nameCounts[base]) {
          nameCounts[base] = 1;
          return file;
        }
        const newName = `${base} (${nameCounts[base]++})${ext}`;
        return { ...file, name: newName };
      });

      // Keep overlay open while Electron picks folder + writes files
      setBulkDownloadCurrentName('Saving to folder…');
      const result = await window.electronAPI.savePdfsToFolder(deduped);

      setBulkDownloading(false);
      setBulkDownloadProgress('');
      setBulkDownloadCurrentName('');
      setBulkDownloadDoneCount(0);
      setBulkDownloadTotal(0);

      if (!result.canceled && result.failed?.length > 0) {
        showBulkError(`Saved to folder. Failed to write: ${result.failed.join(', ')}`);
      }
    } else if (dirHandle) {
      // Browser (Chrome/Edge): write to the already-obtained directory handle
      const writeFailed = [];
      for (const file of files) {
        try {
          // Find a unique filename — if "Payslip_Name.pdf" exists, try "Payslip_Name (1).pdf", etc.
          const dotIdx = file.name.lastIndexOf('.');
          const base = dotIdx >= 0 ? file.name.slice(0, dotIdx) : file.name;
          const ext  = dotIdx >= 0 ? file.name.slice(dotIdx) : '';
          let candidate = file.name;
          let counter = 1;
          while (true) {
            try {
              await dirHandle.getFileHandle(candidate); // throws NotFoundError if absent
              candidate = `${base} (${counter++})${ext}`;
            } catch (e) {
              if (e.name === 'NotFoundError') break; // name is free
              throw e;
            }
          }
          const fileHandle = await dirHandle.getFileHandle(candidate, { create: true });
          const writable = await fileHandle.createWritable();
          const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
          await writable.write(bytes);
          await writable.close();
        } catch {
          writeFailed.push(file.name);
        }
      }
      setBulkDownloading(false);
      setBulkDownloadProgress('');
      setBulkDownloadCurrentName('');
      setBulkDownloadDoneCount(0);
      setBulkDownloadTotal(0);
      if (writeFailed.length > 0) showBulkError(`Failed to save: ${writeFailed.join(', ')}`);
    } else {
      // Fallback: individual browser downloads
      for (const file of files) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${file.data}`;
        link.download = file.name;
        link.click();
        await new Promise(r => setTimeout(r, 150));
      }
      setBulkDownloading(false);
      setBulkDownloadProgress('');
      setBulkDownloadCurrentName('');
      setBulkDownloadDoneCount(0);
      setBulkDownloadTotal(0);
    }

    if (failed.length > 0) showBulkError(`Failed to generate PDF for: ${failed.join(', ')}`);
  };

  const handleBulkDelete = (selectedEmployees) => {
    setBulkDeleteConfirm(selectedEmployees);
  };

  const executeBulkDelete = async () => {
    const selectedEmployees = bulkDeleteConfirm;
    setBulkDeleteConfirm(null);
    setBulkDeleting(true);
    setBulkDeleteDoneCount(0);
    setBulkDeleteTotal(selectedEmployees.length);

    const failed = [];
    for (let i = 0; i < selectedEmployees.length; i++) {
      const emp = selectedEmployees[i];
      setBulkDeleteCurrentName(emp.name);
      try {
        await deleteEmployee(emp.id);
        setRawEmployees(prev => prev.filter(e => e.id !== emp.id));
      } catch {
        failed.push(emp.name);
      }
      setBulkDeleteDoneCount(i + 1);
    }

    setSelectedIds(new Set());
    setBulkDeleting(false);
    setBulkDeleteCurrentName('');
    setBulkDeleteDoneCount(0);
    setBulkDeleteTotal(0);
    if (failed.length > 0) showBulkError(`Failed to delete: ${failed.join(', ')}`);
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

  // Non-identity column defs for PHP dynamic payslip building
  const phpNonIdentityCols = useMemo(() => {
    if (currency !== 'PHP' || !selectedCompany?.columnMappings) return [];
    try {
      const parsed = JSON.parse(selectedCompany.columnMappings);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(c => !['fullName', 'email'].includes(c.systemField));
    } catch { return []; }
  }, [currency, selectedCompany?.columnMappings]);

  const buildDynamicColumns = (emp) => {
    if (phpNonIdentityCols.length === 0) return { dynamicColumns: null, dynamicNetPay: null };
    const cd = (() => { try { return JSON.parse(emp.customData || '{}'); } catch { return {}; } })();
    let dynamicNetPay = null;
    const dynamicColumns = phpNonIdentityCols
      .filter(col => col.systemField !== 'transferFee')
      .filter(col => {
        if (/net\s*pay/i.test(col.label)) {
          const raw = cd[col.key] ?? (col.systemField ? emp[col.systemField] : null);
          if (raw != null && raw !== '') {
            const n = Number(String(raw).replace(/[₱$,\s]/g, ''));
            if (!isNaN(n)) dynamicNetPay = n;
          }
          return false;
        }
        return true;
      })
      .map(col => {
        const raw = cd[col.key] ?? (col.systemField ? emp[col.systemField] : null);
        let formatted;
        if (raw == null || raw === '') {
          formatted = '—';
        } else if (col.type === 'number') {
          const n = Number(String(raw).replace(/[₱$,\s]/g, ''));
          if (isNaN(n)) {
            formatted = String(raw);
          } else if (col.currency) {
            formatted = `₱ ${formatPHP(n)}`;
          } else {
            formatted = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
          }
        } else {
          formatted = String(raw);
        }
        return { label: col.label, value: formatted, isNumber: col.type === 'number' };
      });
    return { dynamicColumns, dynamicNetPay };
  };

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
  const [importOpen,     setImportOpen]     = useState(false);
  const [manageColsOpen, setManageColsOpen] = useState(false);

  const handleImported = (importedExchangeRate, newColumnMappings) => {
    if (!selectedCompany) return;
    // Refresh employees
    fetchEmployees(selectedCompany.id)
      .then(res => setRawEmployees(res.data))
      .catch(() => {});
    // Apply new columnMappings directly to state — don't wait for a re-fetch
    if (newColumnMappings) {
      const updated = { ...selectedCompany, columnMappings: newColumnMappings };
      setSelectedCompany(updated);
      setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
    }
    // If the Excel had an exchange rate column, populate the draft input and
    // the live config (so the table updates immediately), then persist if dates are set.
    if (importedExchangeRate) {
      setConfigDraft(prev => ({ ...prev, exchangeRate: String(importedExchangeRate) }));
      setConfig(prev => ({ ...prev, exchangeRate: importedExchangeRate }));
      if (config.startDate && config.endDate) {
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
    }
  };

  const [employeeDeleteConfirm, setEmployeeDeleteConfirm] = useState(null);

  const handleDeleteEmployee = (emp) => {
    setEmployeeDeleteConfirm(emp);
  };

  const executeDeleteEmployee = async () => {
    const emp = employeeDeleteConfirm;
    setEmployeeDeleteConfirm(null);
    try {
      await deleteEmployee(emp.id);
      setRawEmployees(prev => prev.filter(e => e.id !== emp.id));
    } catch {
      showBulkError('Failed to delete employee. Please try again.');
    }
  };

  const handleDeleteCompany = (company) => {
    setCompanyDeleteConfirm(company);
  };

  const executeDeleteCompany = async () => {
    const company = companyDeleteConfirm;
    setCompanyDeleteConfirm(null);
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

      {/* ── Bulk Send Confirmation Modal ── */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">Confirm Bulk Send</h2>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              You are about to send payslips to <span className="font-bold text-gray-900">{bulkConfirm.length} employees</span>.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This will send {bulkConfirm.length} emails and cannot be stopped once started. Estimated time: ~{Math.ceil(bulkConfirm.length * 1.2 / 60)} min.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkConfirm(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeBulkSend(bulkConfirm)}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Yes, Send All {bulkConfirm.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Send Progress Overlay (non-dismissible) ── */}
      {bulkSending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl text-center">
            <div className="mb-4 flex justify-center">
              <svg className="h-10 w-10 text-green-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Sending Payslips…</p>
            <p className="text-sm text-gray-500 mb-1">{bulkCurrentName}</p>
            <p className="text-sm font-semibold text-gray-700 mb-4">{bulkDoneCount} of {bulkTotal} sent</p>
            <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${bulkTotal > 0 ? (bulkDoneCount / bulkTotal) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">Please do not close this window until sending is complete.</p>
          </div>
        </div>
      )}

      {/* ── Bulk Download Progress Overlay (non-dismissible) ── */}
      {bulkDownloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl text-center">
            <div className="mb-4 flex justify-center">
              <svg className="h-10 w-10 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Generating PDFs…</p>
            <p className="text-sm text-gray-500 mb-1">{bulkDownloadCurrentName}</p>
            <p className="text-sm font-semibold text-gray-700 mb-4">{bulkDownloadDoneCount} of {bulkDownloadTotal} generated</p>
            <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${bulkDownloadTotal > 0 ? (bulkDownloadDoneCount / bulkDownloadTotal) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">Please do not close this window until all PDFs are saved.</p>
          </div>
        </div>
      )}

      {/* ── Single Employee Delete Confirm Modal ── */}
      {employeeDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Delete "{employeeDeleteConfirm.name}"?</p>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone. The employee record will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setEmployeeDeleteConfirm(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={executeDeleteEmployee}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Company Delete Confirm Modal ── */}
      {companyDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Delete "{companyDeleteConfirm.name}"?</p>
            <p className="text-sm text-gray-500 mb-6">This will permanently delete the company and all its employees. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setCompanyDeleteConfirm(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={executeDeleteCompany}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirm Modal ── */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Delete {bulkDeleteConfirm.length} Employee{bulkDeleteConfirm.length > 1 ? 's' : ''}?</p>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone. All selected employee records will be permanently removed.</p>
            <div className="max-h-32 overflow-y-auto rounded-lg bg-gray-50 px-4 py-2 text-left mb-5">
              {bulkDeleteConfirm.map(e => (
                <p key={e.id} className="text-sm text-gray-700 py-0.5">{e.name}</p>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBulkDeleteConfirm(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={executeBulkDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Progress Overlay (non-dismissible) ── */}
      {bulkDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl text-center">
            <div className="mb-4 flex justify-center">
              <svg className="h-10 w-10 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Deleting Employees…</p>
            <p className="text-sm text-gray-500 mb-1">{bulkDeleteCurrentName}</p>
            <p className="text-sm font-semibold text-gray-700 mb-4">{bulkDeleteDoneCount} of {bulkDeleteTotal} deleted</p>
            <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-500"
                style={{ width: `${bulkDeleteTotal > 0 ? (bulkDeleteDoneCount / bulkDeleteTotal) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">Please do not close this window until deletion is complete.</p>
          </div>
        </div>
      )}

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
          <div className="mb-5 flex justify-start gap-2">
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
            {selectedCompany?.currency === 'PHP' && (
              <button
                onClick={() => setManageColsOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-5 py-2.5 text-base font-medium text-purple-700 hover:bg-purple-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Manage Columns
              </button>
            )}
          </div>
          <PayrollTable
            employees={employees}
            currency={currency}
            columnMappings={selectedCompany?.columnMappings ?? null}
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
          className="print:hidden fixed bottom-8 right-8 z-20 flex items-center gap-2 rounded-full bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95"
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
                <p className="text-sm font-semibold text-gray-900">Change pay period?</p>
                <p className="text-xs text-gray-500 mt-0.5">You are updating the pay period dates.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              {sentIds.size > 0
                ? <>All <strong>{sentIds.size}</strong> employee{sentIds.size !== 1 ? 's' : ''} currently marked as <span className="font-medium text-green-600">Sent</span> will be reset to <span className="font-medium text-gray-500">Pending</span> for the new pay period.</>
                : <>Are you sure you want to change the pay period? This will apply to all employees and their payslips.</>
              }
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
          company={selectedCompany}
          onImported={handleImported}
          onClose={() => setImportOpen(false)}
        />
      )}
      {manageColsOpen && selectedCompany?.currency === 'PHP' && (
        <ManageColumnsModal
          company={selectedCompany}
          onSaved={(updated) => {
            setSelectedCompany(updated);
            setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
            setManageColsOpen(false);
            fetchEmployees(updated.id)
              .then(res => setRawEmployees(res.data))
              .catch(() => {});
          }}
          onClose={() => setManageColsOpen(false)}
        />
      )}
      {modalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          companyId={selectedCompany?.id}
          currency={currency}
          exchangeRate={config.exchangeRate}
          columnMappings={selectedCompany?.columnMappings ?? null}
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
