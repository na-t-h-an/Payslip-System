import { useEffect, useState } from 'react';
import { fetchBrevoQuota } from '../../services/api';

export default function EmailQuota() {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBrevoQuota()
      .then(res => {
        if (res.data.error) {
          setError(res.data.error);
        } else {
          setQuota(res.data);
        }
      })
      .catch(err => setError(err?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-end gap-1 min-w-[180px]">
      <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
      <div className="h-1.5 w-full rounded-full bg-gray-200 animate-pulse" />
      <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
    </div>
  );

  if (error || !quota) return (
    <div className="text-xs text-red-400 text-right max-w-[260px]">
      <div className="font-medium">Email quota unavailable</div>
      {error && <div className="text-red-300 break-words">{error}</div>}
    </div>
  );

  if (quota.limit === 0) return null;

  const used = quota.sent;
  const total = quota.limit;
  const remaining = quota.remaining;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const resetDate = quota.resetDate
    ? new Date(quota.resetDate + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : '';

  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-600';

  return (
    <div className="flex flex-col items-end gap-1 min-w-[180px]">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="font-medium text-gray-700">Emails</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{remaining.toLocaleString()}</span> left out of {total.toLocaleString()}
        {resetDate && <span> until {resetDate}</span>}
      </p>
    </div>
  );
}
