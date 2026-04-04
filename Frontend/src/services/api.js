import axios from 'axios';
import { supabase } from '../supabaseClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export default api;

// Companies
export const fetchCompanies = () =>
  api.get('/companies');

export const createCompany = (name) =>
  api.post('/companies', { name });

export const deleteCompany = (id) =>
  api.delete(`/companies/${id}`);

// Employees (always scoped to a company)
export const fetchEmployees = (companyId, search = '') =>
  api.get('/employees', { params: { companyId, search: search || undefined } });

export const createEmployee = (data) =>
  api.post('/employees', data);

export const updateEmployee = (id, data) =>
  api.put(`/employees/${id}`, data);

export const deleteEmployee = (id) =>
  api.delete(`/employees/${id}`);

// Pay Period (always scoped to a company)
export const fetchLatestPayPeriod = (companyId) =>
  api.get('/pay-period/latest', { params: { companyId } });

export const fetchPayPeriodConfig = (startDate, endDate, companyId) =>
  api.get('/pay-period', { params: { startDate, endDate, companyId } });

export const savePayPeriodConfig = (data) =>
  api.post('/pay-period', data);

export const bulkImportEmployees = (companyId, employees) =>
  api.post('/employees/bulk', employees, { params: { companyId } });

// Payslip
export const fetchPayslip = (employeeId, payPeriod) =>
  api.get(`/payslip/${employeeId}`, { params: { payPeriod } });

export const generatePayslip = (body) =>
  api.post('/payslip/generate', body, { headers: { 'Content-Type': 'application/json' } });

export const sendPayslipEmail = (formData) =>
  api.post('/payslip/send-email', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const fetchSentStatus = (payPeriodId) =>
  api.get('/payslip/sent-status', { params: { payPeriodId } });
