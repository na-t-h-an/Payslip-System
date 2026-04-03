import { useState, useEffect } from 'react';
import { fetchPayrollReport } from '../services/api';
import { MOCK_EMPLOYEES, MOCK_PAY_PERIOD_CONFIG } from '../data/mockData';

export function usePayroll(payPeriod) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!payPeriod) return;
    setLoading(true);
    setError(null);

    fetchPayrollReport(payPeriod)
      .then(res => setData(res.data))
      .catch(() => {
        setData({
          config: MOCK_PAY_PERIOD_CONFIG,
          employees: MOCK_EMPLOYEES,
        });
      })
      .finally(() => setLoading(false));
  }, [payPeriod]);

  return { data, loading, error };
}
