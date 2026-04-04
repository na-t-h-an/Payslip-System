import { useState, useEffect, useRef } from 'react';
import { createEmployee, updateEmployee } from '../../services/api';

const EMPTY_FORM = { name: '', email: '', totalHours: '', rate: '', bonus: '', accountNumber: '' };

export default function EmployeeModal({ employee, companyId, exchangeRate, onSave, onClose }) {
  const isEdit = !!employee;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name,
        email: employee.email,
        totalHours: employee.totalHours,
        rate: employee.rate,
        bonus: employee.bonus || '',
        accountNumber: employee.accountNumber || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [employee]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

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
      accountNumber: form.accountNumber.trim() || null,
    };

    setSubmitting(true);
    setServerError(null);
    try {
      const res = isEdit
        ? await updateEmployee(employee.id, payload)
        : await createEmployee(payload);

      onSave({
        ...res.data,
        exchangeRate,
        totalPhpPay: res.data.totalPay * exchangeRate,
      });
    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (key) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      errors[key]
        ? 'border-red-400 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            {isEdit ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              ref={firstInputRef}
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Maria Santos"
              className={inputClass('name')}
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
              className={inputClass('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Total Hours</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.totalHours}
                onChange={e => set('totalHours', e.target.value)}
                placeholder="e.g. 80.00"
                className={inputClass('totalHours')}
              />
              {errors.totalHours && <p className="mt-1 text-xs text-red-500">{errors.totalHours}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Rate (USD/hr)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.rate}
                onChange={e => set('rate', e.target.value)}
                placeholder="e.g. 9.00"
                className={inputClass('rate')}
              />
              {errors.rate && <p className="mt-1 text-xs text-red-500">{errors.rate}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Bonus (USD)
              <span className="ml-2 text-xs font-normal text-gray-400">— Optional</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.bonus}
              onChange={e => set('bonus', e.target.value)}
              placeholder="e.g. 20.00"
              className={inputClass('bonus')}
            />
            {errors.bonus && <p className="mt-1 text-xs text-red-500">{errors.bonus}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Account Number
              <span className="ml-2 text-xs font-normal text-gray-400">— Optional</span>
            </label>
            <input
              type="text"
              value={form.accountNumber}
              onChange={e => set('accountNumber', e.target.value)}
              placeholder="e.g. 1234-5678-9012"
              className={inputClass('accountNumber')}
            />
          </div>

          {/* Live computed preview */}
          {form.totalHours !== '' && form.rate !== '' && !isNaN(form.totalHours) && !isNaN(form.rate) && (
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm">
              {(() => {
                const h = parseFloat(form.totalHours) || 0;
                const r = parseFloat(form.rate) || 0;
                const b = parseFloat(form.bonus) || 0;
                const totalUSD = h * r + b;
                const totalPHP = totalUSD * exchangeRate;
                return (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Pay (USD)</span>
                    <span className="font-medium text-gray-900">${totalUSD.toFixed(2)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-semibold text-blue-600">₱{new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2 }).format(totalPHP)}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
          )}

          {/* Actions */}
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
