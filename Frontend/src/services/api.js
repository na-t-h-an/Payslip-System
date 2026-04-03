import axios from 'axios';
import { supabase } from '../supabaseClient'; // 1. Import your Supabase instance

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
  // withCredentials: true // 2. You can usually disable this now that we use Bearer Tokens
});

// 3. THE INTERCEPTOR: The "Security Checkpoint"
api.interceptors.request.use(async (config) => {
  // Get the current session from Supabase
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    // Attach the "Passport" (JWT) to the Authorization header
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;

// --- API Methods remain clean and simple ---

export const fetchEmployees = (search = '') =>
  api.get('/employees', { params: { search } });

export const createEmployee = (data) =>
  api.post('/employees', data);

export const updateEmployee = (id, data) =>
  api.put(`/employees/${id}`, data);

export const fetchPayrollReport = (payPeriod) =>
  api.get('/payroll', { params: { payPeriod } });

export const fetchLatestPayPeriod = () =>
  api.get('/pay-period/latest');

export const fetchPayPeriodConfig = (startDate, endDate) =>
  api.get('/pay-period', { params: { startDate, endDate } });

export const savePayPeriodConfig = (data) =>
  api.post('/pay-period', data);

export const fetchPayslip = (employeeId, payPeriod) =>
  api.get(`/payslip/${employeeId}`, { params: { payPeriod } });

export const generatePayslip = (body) =>
  api.post('/payslip/generate', body);

export const sendPayslipEmail = (formData) =>
  api.post('/payslip/send-email', formData, {
    // Axios will automatically handle the boundary for multipart/form-data
    headers: { 'Content-Type': 'multipart/form-data' },
  });