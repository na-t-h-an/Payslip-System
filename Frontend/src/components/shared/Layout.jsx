import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();

  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="print:hidden sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-full items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img
              src="/DMA.png"
              alt="DMA Logo"
              className="h-12 w-auto object-contain"
            />
            <span className="text-lg font-semibold text-gray-800">Payslip System</span>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/payroll" className={linkClass}>Payroll Report</NavLink>
            <button
              onClick={handleLogout}
              className="ml-2 flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-full px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
