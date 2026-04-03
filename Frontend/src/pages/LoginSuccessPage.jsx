import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // 1. Import the client

export default function LoginSuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // 2. Instead of checking URL params, we ask Supabase if the user is in
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (session) {
        // Success! Supabase has already saved the token for us.
        console.log("Logged in as:", session.user.email);
        navigate('/payroll', { replace: true });
      } else if (error) {
        console.error("Auth error:", error.message);
        navigate('/login', { replace: true });
      }
    };

    checkSession();
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      {/* A nice loading spinner for the accountants */}
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      <p className="mt-4 text-sm text-gray-500 font-medium">Verifying your DMA credentials...</p>
    </div>
  );
}