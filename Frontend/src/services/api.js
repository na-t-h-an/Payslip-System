import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' }
});

export default api;

export const fetchEmployees = (search = '') =>
  api.get('/employees', { params: { search } });

export const fetchPayrollReport = (payPeriod) =>
  api.get('/payroll', { params: { payPeriod } });

export const fetchPayslip = (employeeId, payPeriod) =>
  api.get(`/payslip/${employeeId}`, { params: { payPeriod } });

export const generatePayslip = (body) =>
  api.post('/payslip/generate', body);
