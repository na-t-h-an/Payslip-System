import { useNavigate, useLocation } from 'react-router-dom';

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email || '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg px-10 py-10 max-w-sm w-full text-center">

        {/* X icon */}
        <div className="flex justify-center mb-5">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-800 mb-2">Access denied</h1>
        <p className="text-sm text-gray-500 mb-3">
          Your Google account is not authorized to access this system.
        </p>

        {email && (
          <p className="text-sm font-semibold text-red-500 mb-3 break-all">{email}</p>
        )}

        <p className="text-sm text-gray-500 mb-7">
          Contact your administrator if you believe this is a mistake.
        </p>

        {/* Back to sign in button */}
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.5 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/>
            <path fill="#FBBC05" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.5 26.9 36 24 36c-5.1 0-9.6-3.1-11.3-7.5l-6.5 5C9.7 39.7 16.3 44 24 44z"/>
            <path fill="#EA4335" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C42 35.2 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          Back to sign in
        </button>

        <p className="mt-6 text-xs text-gray-400">DMA Global Accounting Services, Co.</p>
      </div>
    </div>
  );
}
