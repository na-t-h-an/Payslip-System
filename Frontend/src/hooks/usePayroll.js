import { useState, useEffect } from 'react';
import { fetchPayrollReport, fetchEmployees } from '../services/api';
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
      .catch(async () => {
        // Payroll endpoint not ready yet — fetch real employees and use mock config
        try {
          const empRes = await fetchEmployees('');
          const exchangeRate = MOCK_PAY_PERIOD_CONFIG.exchangeRate;
          const employees = empRes.data.map(emp => ({
            ...emp,
            exchangeRate,
            totalPhpPay: emp.totalPay * exchangeRate,
          }));
          setData({ config: MOCK_PAY_PERIOD_CONFIG, employees });
        } catch {
          setData({ config: MOCK_PAY_PERIOD_CONFIG, employees: MOCK_EMPLOYEES });
        }
      })
      .finally(() => setLoading(false));
  }, [payPeriod]);

  return { data, loading, error };
}
