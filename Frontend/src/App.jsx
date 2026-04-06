import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { fetchCompanies } from './services/api';
import Layout from './components/shared/Layout';
import LoginPage from './pages/LoginPage';
import LoginSuccessPage from './pages/LoginSuccessPage';
import PayrollPage from './pages/PayrollPage';
import PayslipPage from './pages/PayslipPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import LoadingSpinner from './components/shared/LoadingSpinner';

function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    const verifyUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        await fetchCompanies();
        setStatus('authorized');
      } catch (err) {
        if (err.response?.status === 403 || err.response?.status === 401) {
          const email = session.user?.email || '';
          await supabase.auth.signOut();
          navigate('/access-denied', { replace: true, state: { email } });
        } else {
          setStatus('authorized');
        }
      }
    };
    verifyUser();
  }, []);

  if (status === 'loading') return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <LoadingSpinner />
    </div>
  );
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login-success" element={<LoginSuccessPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />

        {/* Protected routes inside Layout */}
        <Route element={<Layout />}>
          <Route
            path="/payroll"
            element={<ProtectedRoute><PayrollPage /></ProtectedRoute>}
          />
          <Route
            path="/payslip"
            element={<ProtectedRoute><PayslipPage /></ProtectedRoute>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
