import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/shared/Layout';
import LoginPage from './pages/LoginPage';
import PayrollPage from './pages/PayrollPage';
import PayslipPage from './pages/PayslipPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/payslip" element={<PayslipPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
