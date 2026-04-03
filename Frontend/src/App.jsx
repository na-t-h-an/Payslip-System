import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient'; // Make sure this path is correct
import Layout from './components/shared/Layout';
import LoginPage from './pages/LoginPage';
import LoginSuccessPage from './pages/LoginSuccessPage';
import PayrollPage from './pages/PayrollPage';
import PayslipPage from './pages/PayslipPage';

// 1. The Smarter Bouncer
function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for the session once on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes (Sign in, Sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // If no session exists, send them to the login page
  if (!session) {
    return <Navigate to="/" replace />;
  }

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