import { useState, useEffect } from 'react';
import { fetchPayslip } from '../services/api';
import { getMockPayslip } from '../data/mockData';

export function usePayslip(employeeId, config) {
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!employeeId) {
      setPayslip(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetchPayslip(employeeId, config.payPeriod)
      .then(res => setPayslip(res.data))
      .catch(() => {
        const mock = getMockPayslip(employeeId, config);
        setPayslip(mock);
      })
      .finally(() => setLoading(false));
  }, [employeeId, config.payPeriod, config.exchangeRate, config.transferFee, config.bonusOverride]);

  return { payslip, loading, error };
}
