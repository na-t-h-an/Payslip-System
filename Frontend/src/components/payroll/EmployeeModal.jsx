import { useState, useEffect, useRef, useMemo } from 'react';
import { createEmployee, updateEmployee } from '../../services/api';
import { evaluateCustomColumns } from '../../utils/evaluateCustomColumns';

const EMPTY_FORM = { name: '', email: '', totalHours: '', rate: '', bonus: '', bankName: '', accountNumber: '', transferFee: '' };

export default function EmployeeModal({ employee, companyId, currency = 'USD', exchangeRate, columnMappings, onSave, onClose }) {
  const isEdit = !!employee;
  const [form, setForm] = useState(EMPTY_FORM);
  const [phpForm, setPhpForm] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const firstInputRef = useRef(null);
  const mouseDownTargetRef = useRef(null);

  // Parse column definitions for PHP dynamic mode
  const allColDefs = useMemo(() => {
    if (!columnMappings) return [];
    try {
      const parsed = JSON.parse(columnMappings);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [columnMappings]);

  // Non-identity, non-formula columns → editable inputs
  const editableCols = useMemo(() =>
    allColDefs.filter(c =>
      !['fullName', 'email'].includes(c.systemField) &&
      !(c.formula && Array.isArray(c.formula.terms) && c.formula.terms.length > 0)
    ),
    [allColDefs]
  );

  const nonIdentityCols = useMemo(() =>
    allColDefs.filter(c => !['fullName', 'email'].includes(c.systemField)),
    [allColDefs]
  );

  const isPhpDynamic = currency === 'PHP' && editableCols.length > 0;
  const hasBankCol = editableCols.some(c => c.systemField === 'bankName');
  const hasAcctCol = editableCols.some(c => c.systemField === 'accountNumber');
  const hasFeeCol  = editableCols.some(c => c.systemField === 'transferFee');

  // ── Standard mode init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isPhpDynamic) return;
    if (employee) {
      setForm({
        name: employee.name,
        email: employee.email,
        totalHours: employee.totalHours,
        rate: employee.rate,
        bonus: employee.bonus || '',
        bankName: employee.bankName || '',
        accountNumber: employee.accountNumber || '',
        transferFee: employee.transferFee != null && employee.transferFee !== 0 ? employee.transferFee : '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [employee, isPhpDynamic]);

  // ── PHP dynamic mode init ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isPhpDynamic) return;
    const cd = (() => { try { return JSON.parse(employee?.customData || '{}'); } catch { return {}; } })();
    const f = { name: employee?.name || '', email: employee?.email || '' };
    for (const col of editableCols) {
      const sf = col.systemField;
      if (sf === 'totalHours' || sf === 'rate' || sf === 'bonus') {
        f[col.key] = employee?.[sf] != null ? String(employee[sf]) : '';
      } else if (sf === 'bankName') {
        f[col.key] = employee?.bankName || '';
      } else if (sf === 'accountNumber') {
        f[col.key] = employee?.accountNumber || '';
      } else if (sf === 'transferFee') {
        f[col.key] = employee?.transferFee && employee.transferFee !== 0 ? String(employee.transferFee) : '';
      } else {
        f[col.key] = cd[col.key] != null ? String(cd[col.key]) : '';
      }
    }
    if (!hasBankCol) f._bankName = employee?.bankName || '';
    if (!hasAcctCol) f._accountNumber = employee?.accountNumber || '';
    if (!hasFeeCol)  f._transferFee  = employee?.transferFee && employee.transferFee !== 0 ? String(employee.transferFee) : '';
    setPhpForm(f);
    setErrors({});
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [employee, isPhpDynamic, editableCols, hasBankCol, hasAcctCol, hasFeeCol]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Re-focus the first input when the window regains focus (e.g. after a
  // native Electron dialog steals focus and the window becomes active again)
  useEffect(() => {
    const handler = () => setTimeout(() => firstInputRef.current?.focus(), 50);
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const set    = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setPhp = (key, value) => setPhpForm(f => ({ ...f, [key]: value }));

  const inputCls = (key) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      errors[key]
        ? 'border-red-400 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  // ── Standard validation ─────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.';
    if (form.totalHours === '' || isNaN(form.totalHours) || Number(form.totalHours) < 0)
      errs.totalHours = 'Enter valid hours.';
    if (form.rate === '' || isNaN(form.rate) || Number(form.rate) <= 0)
      errs.rate = 'Enter a valid rate.';
    if (form.bonus !== '' && (isNaN(form.bonus) || Number(form.bonus) < 0))
      errs.bonus = 'Enter a valid bonus or leave blank.';
    return errs;
  };

  // ── PHP dynamic validation ──────────────────────────────────────────────────
  const validatePhp = () => {
    const errs = {};
    if (!phpForm.name?.trim()) errs.name = 'Name is required.';
    if (!phpForm.email?.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(phpForm.email)) errs.email = 'Enter a valid email.';
    for (const col of editableCols) {
      if (col.type === 'number' && phpForm[col.key] !== '' && isNaN(phpForm[col.key])) {
        errs[col.key] = 'Enter a valid number.';
      }
    }
    return errs;
  };

  // ── Standard submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const resolvedCompanyId = companyId ?? employee?.companyId ?? null;
    const payload = {
      ...(resolvedCompanyId != null ? { companyId: resolvedCompanyId } : {}),
      fullName: form.name.trim(),
      email: form.email.trim(),
      totalHours: parseFloat(form.totalHours),
      rate: parseFloat(form.rate),
      bonus: form.bonus !== '' ? parseFloat(form.bonus) : 0,
      bankName: form.bankName.trim() || null,
      accountNumber: form.accountNumber.trim() || null,
      transferFee: form.transferFee !== '' ? parseFloat(form.transferFee) : 0,
    };
    setSubmitting(true);
    setServerError(null);
    try {
      const res = isEdit
        ? await updateEmployee(employee.id, payload)
        : await createEmployee(payload);
      onSave({ ...res.data, exchangeRate, totalPhpPay: res.data.totalPay * exchangeRate });
    } catch (err) {
      const raw = JSON.stringify(err.response?.data || '').toLowerCase();
      if (raw.includes('duplicate') || raw.includes('unique') || raw.includes('constraint')) {
        setServerError(`The email "${form.email.trim()}" is already used by another employee.`);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── PHP dynamic submit ──────────────────────────────────────────────────────
  const handlePhpSubmit = async (e) => {
    e.preventDefault();
    const errs = validatePhp();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const systemVals = { totalHours: 0, rate: 0, bonus: 0, bankName: null, accountNumber: null, transferFee: 0 };
    const rawCustomData = {};

    for (const col of editableCols) {
      const rawVal = phpForm[col.key] ?? '';
      rawCustomData[col.key] = col.type === 'number' ? (parseFloat(rawVal) || 0) : (rawVal || '');
      const sf = col.systemField;
      if (sf === 'totalHours')    systemVals.totalHours    = parseFloat(rawVal) || 0;
      else if (sf === 'rate')     systemVals.rate           = parseFloat(rawVal) || 0;
      else if (sf === 'bonus')    systemVals.bonus          = parseFloat(rawVal) || 0;
      else if (sf === 'bankName') systemVals.bankName       = rawVal || null;
      else if (sf === 'accountNumber') systemVals.accountNumber = rawVal || null;
      else if (sf === 'transferFee')   systemVals.transferFee   = parseFloat(rawVal) || 0;
    }
    if (!hasBankCol) systemVals.bankName       = phpForm._bankName?.trim() || null;
    if (!hasAcctCol) systemVals.accountNumber  = phpForm._accountNumber?.trim() || null;
    if (!hasFeeCol)  systemVals.transferFee    = parseFloat(phpForm._transferFee) || 0;

    const computed = evaluateCustomColumns(nonIdentityCols, rawCustomData);
    const resolvedCompanyId = companyId ?? employee?.companyId ?? null;

    const payload = {
      ...(resolvedCompanyId != null ? { companyId: resolvedCompanyId } : {}),
      fullName: phpForm.name.trim(),
      email: phpForm.email.trim(),
      ...systemVals,
      customData: JSON.stringify(computed),
    };

    setSubmitting(true);
    setServerError(null);
    try {
      const res = isEdit
        ? await updateEmployee(employee.id, payload)
        : await createEmployee(payload);
      onSave(res.data);
    } catch (err) {
      const raw = JSON.stringify(err.response?.data || '').toLowerCase();
      if (raw.includes('duplicate') || raw.includes('unique') || raw.includes('constraint')) {
        setServerError(`The email "${phpForm.email.trim()}" is already used by another employee.`);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const backdropProps = {
    className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4',
    onMouseDown: (e) => { mouseDownTargetRef.current = e.target; },
    onMouseUp:   (e) => { if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) onClose(); },
  };

  const CloseBtn = () => (
    <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  // ── PHP dynamic mode render ─────────────────────────────────────────────────
  if (isPhpDynamic) {
    return (
      <div {...backdropProps}>
        <div className="w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-800">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
            <CloseBtn />
          </div>

          <form onSubmit={handlePhpSubmit} className="overflow-y-auto flex-1 space-y-4 px-6 py-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input ref={firstInputRef} type="text" value={phpForm.name || ''} onChange={e => setPhp('name', e.target.value)}
                placeholder="e.g. Maria Santos" className={inputCls('name')} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={phpForm.email || ''} onChange={e => setPhp('email', e.target.value)}
                placeholder="e.g. maria@gmail.com" className={inputCls('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            {(() => {
              const renderColInput = (c) => (
                <div key={c.key}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{c.label}</label>
                  {c.type === 'number' ? (
                    <input type="number" step="any" value={phpForm[c.key] ?? ''} onChange={e => setPhp(c.key, e.target.value)}
                      placeholder="0" className={inputCls(c.key)} />
                  ) : (
                    <input type="text" value={phpForm[c.key] ?? ''} onChange={e => setPhp(c.key, e.target.value)}
                      className={inputCls(c.key)} />
                  )}
                  {errors[c.key] && <p className="mt-1 text-xs text-red-500">{errors[c.key]}</p>}
                </div>
              );
              const rows = [];
              let i = 0;
              while (i < editableCols.length) {
                const col  = editableCols[i];
                const next = editableCols[i + 1];
                if (next && col.type === next.type) {
                  rows.push(
                    <div key={col.key + next.key} className="grid grid-cols-2 gap-3">
                      {renderColInput(col)}{renderColInput(next)}
                    </div>
                  );
                  i += 2;
                } else {
                  rows.push(renderColInput(col));
                  i += 1;
                }
              }
              return rows;
            })()}

            {(!hasBankCol || !hasAcctCol || !hasFeeCol) && (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Payment Info</p>
                {!hasBankCol && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Bank Name <span className="ml-1 text-xs font-normal text-gray-400">Optional</span>
                    </label>
                    <input type="text" value={phpForm._bankName || ''} onChange={e => setPhp('_bankName', e.target.value)}
                      placeholder="e.g. BPI, BDO, GCash" className={inputCls('_bankName')} />
                  </div>
                )}
                {!hasAcctCol && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Account Number <span className="ml-1 text-xs font-normal text-gray-400">Optional</span>
                    </label>
                    <input type="text" value={phpForm._accountNumber || ''} onChange={e => setPhp('_accountNumber', e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric" placeholder="e.g. 123456789012" className={inputCls('_accountNumber')} />
                  </div>
                )}
                {!hasFeeCol && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Transfer Fee (₱) <span className="ml-1 text-xs font-normal text-gray-400">Optional</span>
                    </label>
                    <input type="number" step="0.01" min="0" value={phpForm._transferFee || ''} onChange={e => setPhp('_transferFee', e.target.value)}
                      placeholder="e.g. 10.00" className={inputCls('_transferFee')} />
                  </div>
                )}
              </div>
            )}

            {serverError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={submitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                {submitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Employee')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Standard mode render ────────────────────────────────────────────────────
  return (
    <div {...backdropProps}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            {isEdit ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <CloseBtn />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              ref={firstInputRef}
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Maria Santos"
              className={inputCls('name')}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="e.g. maria@gmail.com"
              className={inputCls('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Total Hours</label>
              <input
                type="number" step="0.01" min="0"
                value={form.totalHours}
                onChange={e => set('totalHours', e.target.value)}
                placeholder="e.g. 80.00"
                className={inputCls('totalHours')}
              />
              {errors.totalHours && <p className="mt-1 text-xs text-red-500">{errors.totalHours}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Rate ({currency}/hr)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.rate}
                onChange={e => set('rate', e.target.value)}
                placeholder="e.g. 9.00"
                className={inputCls('rate')}
              />
              {errors.rate && <p className="mt-1 text-xs text-red-500">{errors.rate}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Bonus ({currency})
              <span className="ml-2 text-xs font-normal text-gray-400">— Optional</span>
            </label>
            <input
              type="number" step="0.01" min="0"
              value={form.bonus}
              onChange={e => set('bonus', e.target.value)}
              placeholder="e.g. 20.00"
              className={inputCls('bonus')}
            />
            {errors.bonus && <p className="mt-1 text-xs text-red-500">{errors.bonus}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Bank Name
              <span className="ml-2 text-xs font-normal text-gray-400">Optional</span>
            </label>
            <input
              type="text"
              value={form.bankName}
              onChange={e => set('bankName', e.target.value)}
              placeholder="e.g. BPI, BDO, GCash"
              className={inputCls('bankName')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Account Number
                <span className="ml-2 text-xs font-normal text-gray-400">Optional</span>
              </label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={e => set('accountNumber', e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 123456789012"
                inputMode="numeric"
                className={inputCls('accountNumber')}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Transfer Fee (₱)
                <span className="ml-2 text-xs font-normal text-gray-400">Optional</span>
              </label>
              <input
                type="number" step="0.01" min="0"
                value={form.transferFee}
                onChange={e => set('transferFee', e.target.value)}
                placeholder="e.g. 10.00"
                className={inputCls('transferFee')}
              />
            </div>
          </div>

          {/* Live computed preview */}
          {form.totalHours !== '' && form.rate !== '' && !isNaN(form.totalHours) && !isNaN(form.rate) && (
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm space-y-1">
              {(() => {
                const h = parseFloat(form.totalHours) || 0;
                const r = parseFloat(form.rate) || 0;
                const b = parseFloat(form.bonus) || 0;
                const fee = parseFloat(form.transferFee) || 0;
                const totalMain = h * r + b;
                const fmtPHP = (n) => '₱' + new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2 }).format(n);
                if (currency === 'PHP') {
                  const netPay = totalMain - fee;
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Pay</span>
                        <span className="font-semibold text-blue-600">{fmtPHP(totalMain)}</span>
                      </div>
                      {fee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Net Pay (after fee)</span>
                          <span className="font-semibold text-blue-700">{fmtPHP(netPay)}</span>
                        </div>
                      )}
                    </>
                  );
                }
                const totalPHP = totalMain * exchangeRate;
                const netPay = totalPHP - fee;
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Pay (USD)</span>
                      <span className="font-medium text-gray-900">${totalMain.toFixed(2)} → <span className="text-blue-600">{fmtPHP(totalPHP)}</span></span>
                    </div>
                    {fee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Net Pay (after fee)</span>
                        <span className="font-semibold text-blue-700">{fmtPHP(netPay)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Employee')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
