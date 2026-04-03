import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // sends session cookie for cross-origin requests
});

export default api;

export const fetchEmployees = (search = '') =>
  api.get('/employees', { params: { search } });

export const createEmployee = (data) =>
  api.post('/employees', data);

export const updateEmployee = (id, data) =>
  api.put(`/employees/${id}`, data);

export const fetchPayrollReport = (payPeriod) =>
  api.get('/payroll', { params: { payPeriod } });

export const fetchPayslip = (employeeId, payPeriod) =>
  api.get(`/payslip/${employeeId}`, { params: { payPeriod } });

export const generatePayslip = (body) =>
  api.post('/payslip/generate', body);

export const sendPayslipEmail = (formData) =>
  api.post('/payslip/send-email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
