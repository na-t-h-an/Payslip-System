import { useState, useEffect } from 'react';
import { fetchPayslip } from '../services/api';

export function usePayslip(employeeId, config) {
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1. If no employee is selected, reset and exit
    if (!employeeId) {
      setPayslip(null);
      return;
    }

    const getPayslipData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetchPayslip(employeeId, config.payPeriod);
        // 2. Set the real data from your Spring Boot controller
        setPayslip(res.data);
      } catch (err) {
        // 3. Capture the real error (401, 404, etc.) instead of using mocks
        const msg = err.response?.data?.message || "Could not retrieve payslip from server.";
        setError(msg);
        console.error("Payslip API Error:", err);
      } finally {
        setLoading(false);
      }
    };

    getPayslipData();
    
    // We only re-run if the ID or the period changes
  }, [employeeId, config.payPeriod]);

  return { payslip, loading, error };
}