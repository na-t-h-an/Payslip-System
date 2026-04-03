import { useState, useEffect } from 'react';
import { fetchPayrollReport } from '../services/api';

export function usePayroll(payPeriod) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Don't even try if the period is empty
    if (!payPeriod) return;

    const getPayrollData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetchPayrollReport(payPeriod);
        // Success: Set the real data from your Spring Boot / Supabase DB
        setData(res.data);
      } catch (err) {
        // Failure: Capture the real error (401, 403, 500, etc.)
        const errorMessage = err.response?.data?.message || err.message || "Failed to load payroll report";
        setError(errorMessage);
        console.error("Payroll API Error:", err);
      } finally {
        setLoading(false);
      }
    };

    getPayrollData();
  }, [payPeriod]);

  return { data, loading, error };
}