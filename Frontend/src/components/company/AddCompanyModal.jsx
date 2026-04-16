import { useState, useEffect, useRef } from 'react';
import { createCompany } from '../../services/api';

export default function AddCompanyModal({ onCreated, onClose }) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50);
  }, []);

  // Re-focus when window regains focus after a native Electron dialog
  useEffect(() => {
    const handler = () => setTimeout(() => nameRef.current?.focus(), 50);
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createCompany(name.trim(), currency);
      onCreated(res.data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create company.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-gray-800">Add Company</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Company Name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Inc"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
            <div className="flex gap-3">
              {['USD', 'PHP'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    currency === c
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {c === 'USD' ? '$ USD' : '₱ PHP'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {currency === 'USD'
                ? 'Employee rates are in USD and converted to PHP using an exchange rate.'
                : 'Employee rates are in PHP. No exchange rate conversion needed.'}
            </p>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
