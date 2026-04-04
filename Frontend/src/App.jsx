import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient'; // Make sure this path is correct
import { fetchCompanies } from './services/api';
import Layout from './components/shared/Layout';
import LoginPage from './pages/LoginPage';
import LoginSuccessPage from './pages/LoginSuccessPage';
import PayrollPage from './pages/PayrollPage';
import PayslipPage from './pages/PayslipPage';
import LoadingSpinner from './components/shared/LoadingSpinner'; // Adjust the path as needed

function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading', 'authorized', 'denied'

  useEffect(() => {
    const verifyUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('denied');
        return;
      }

      try {
        // Call any authenticated endpoint (e.g., fetchCompanies)
        // If the global filter is active, this will 403 for non-whitelisted users
        await fetchCompanies();
        setStatus('authorized');
      } catch (err) {
        if (err.response?.status === 403) {
          await supabase.auth.signOut();
          setStatus('denied');
        } else {
          setStatus('authorized'); // Allow if it's just a network error
        }
      }
    };
    verifyUser();
  }, []);

  if (status === 'loading') return <LoadingSpinner />;
  if (status === 'denied') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login-success" element={<LoginSuccessPage />} />
        
        {/* All these routes are now protected by the Supabase session */}
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