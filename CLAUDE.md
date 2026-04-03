# DMA Global Accounting Services — Payslip System
## Claude.md · Frontend Developer Reference (React JS)

---

## Project Overview

A web-based payroll management system for **DMA Global Accounting Services, Co.** replacing their Excel-based workflow. The system has two core modules:

1. **Payroll Report** — A paginated, searchable table of all employees for a given pay period
2. **Payslip Generator** — A form-driven, printable payslip for an individual employee

Backend: **Spring Boot REST API**
Frontend: **React JS** (this document)
Styling: Your choice — Tailwind CSS recommended, or CSS Modules

---

## Project Structure (Recommended)

```
src/
├── components/
│   ├── payroll/
│   │   ├── PayrollReport.jsx         # Full employee table view
│   │   ├── PayrollTable.jsx          # Table component with sort/filter
│   │   └── PayrollRow.jsx            # Individual row component
│   ├── payslip/
│   │   ├── PayslipGenerator.jsx      # Main payslip form + preview layout
│   │   ├── EmployeeSearchDropdown.jsx # Searchable employee selector
│   │   ├── PayslipPreview.jsx        # Printable payslip card
│   │   └── PayslipPrintWrapper.jsx   # Print-only wrapper
│   └── shared/
│       ├── PageHeader.jsx            # DMA logo + page title
│       ├── LoadingSpinner.jsx
│       └── EmptyState.jsx
├── pages/
│   ├── PayrollPage.jsx               # Route: /payroll
│   └── PayslipPage.jsx               # Route: /payslip
├── hooks/
│   ├── useEmployees.js               # Fetch employee list from API
│   ├── usePayroll.js                 # Fetch payroll report data
│   └── usePayslip.js                 # Generate/fetch single payslip
├── services/
│   └── api.js                        # Axios instance + all API calls
├── utils/
│   ├── formatCurrency.js             # PHP / USD formatters
│   └── calculatePay.js               # Pay computation helpers
└── constants/
    └── payroll.js                    # Default exchange rate, transfer fee, etc.
```

---

## Data Models

These are the shapes you'll receive from the Spring Boot API and use in your components.

### PayPeriodConfig
```js
{
  payPeriod: "March 15, 2026 to March 28, 2026",  // string
  exchangeRate: 60.22,                              // number (PHP per 1 USD)
  transferFee: 10.00                                // number (PHP)
}
```

### Employee (used in dropdown & payroll table)
```js
{
  id: 1,                                           // number
  name: "Anna Katrina Marcos",                     // string
  email: "anna.rm0417@gmail.com",                  // string
  totalHours: 85.50,                               // number
  rate: 9.00,                                      // number (USD per hour)
  pay: 769.50,                                     // number (totalHours × rate)
  bonus: 30.00,                                    // number (0 if none)
  totalPay: 799.50,                                // number (pay + bonus)
  exchangeRate: 60.22,                             // number
  totalPhpPay: 48145.89                            // number (totalPay × exchangeRate)
}
```

### PayslipData (single employee payslip)
```js
{
  payTo: "Analiza Patrocino",
  payPeriod: "March 15, 2026 to March 28, 2026",
  emailAddress: "analiza.patrocinio2022@gmail.com",
  hoursWorked: 36.58,
  agentRate: 4.00,                   // USD
  bonus: 0,                          // USD (null or 0 if none)
  totalPayUSD: 146.32,
  currentExchangeRate: 60.22,
  convertedPayPHP: 8811.39,
  deductions: {
    transferFee: 10.00
  },
  netPay: 8801.39                    // PHP
}
```

---

## API Contract (Spring Boot Endpoints)

Define these in `src/services/api.js`.

```js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' }
});

export default api;

// GET /employees?search=anna
// Returns: Employee[]
export const fetchEmployees = (search = '') =>
  api.get('/employees', { params: { search } });

// GET /payroll?payPeriod=2026-03-15_2026-03-28
// Returns: { config: PayPeriodConfig, employees: Employee[] }
export const fetchPayrollReport = (payPeriod) =>
  api.get('/payroll', { params: { payPeriod } });

// GET /payslip/:employeeId?payPeriod=...
// Returns: PayslipData
export const fetchPayslip = (employeeId, payPeriod) =>
  api.get(`/payslip/${employeeId}`, { params: { payPeriod } });

// POST /payslip/generate  (if you need server-side PDF generation)
// Body: { employeeId, payPeriod, bonusOverride? }
// Returns: PayslipData
export const generatePayslip = (body) =>
  api.post('/payslip/generate', body);
```

---

## Module 1 — Payroll Report

### What It Shows
A full-width table of all employees in the current pay period.

### Columns (match Excel exactly)

| # | Column Header | Field | Format |
|---|---|---|---|
| 1 | Name | `name` | plain text |
| 2 | Email Address | `email` | plain text, smaller font |
| 3 | Total Hours | `totalHours` | `85.50` (2 decimal) |
| 4 | Rate | `rate` | `$9.00` |
| 5 | Pay | `pay` | `769.50` |
| 6 | Bonus | `bonus` | `30.00` or blank if 0 |
| 7 | Total Pay | `totalPay` | `799.50` |
| 8 | Ex Rate | `exchangeRate` | `60.22` |
| 9 | Total PHP Pay | `totalPhpPay` | `₱48,145.89` — styled in blue/accent color |

### Payroll Report Component Spec

```jsx
// pages/PayrollPage.jsx
import { useState } from 'react';
import { usePayroll } from '../hooks/usePayroll';
import PayrollTable from '../components/payroll/PayrollTable';
import PageHeader from '../components/shared/PageHeader';

export default function PayrollPage() {
  const [payPeriod, setPayPeriod] = useState('March 15, 2026 to March 28, 2026');
  const { data, loading, error } = usePayroll(payPeriod);

  return (
    <div>
      <PageHeader title="Payroll Report" />

      {/* Pay Period Config Banner (yellow strip matching Excel) */}
      <div className="config-banner">
        <span>Pay Period: <strong>{data?.config.payPeriod}</strong></span>
        <span>Exchange Rate: <strong>{data?.config.exchangeRate}</strong></span>
        <span>Transfer Fee: <strong>₱{data?.config.transferFee}</strong></span>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {data && <PayrollTable employees={data.employees} />}
    </div>
  );
}
```

```jsx
// components/payroll/PayrollTable.jsx
// Props: employees: Employee[]

// Features:
// - Sticky header row
// - Alternating row colors
// - Column 9 (Total PHP Pay) styled in accent blue
// - Search/filter by name or email (client-side)
// - Sort by any column (click header)
// - Export to CSV button (optional)
```

### usePayroll Hook
```js
// hooks/usePayroll.js
import { useState, useEffect } from 'react';
import { fetchPayrollReport } from '../services/api';

export function usePayroll(payPeriod) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!payPeriod) return;
    setLoading(true);
    fetchPayrollReport(payPeriod)
      .then(res => setData(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [payPeriod]);

  return { data, loading, error };
}
```

---

## Module 2 — Payslip Generator

### Layout: Two-Column on Desktop, Stacked on Mobile
```
┌─────────────────────────┬────────────────────────────┐
│   LEFT: Form / Inputs   │   RIGHT: Payslip Preview   │
│                         │                            │
│  [Employee Search]      │   DMA Global Accounting    │
│  [Pay Period]           │   ─────────────────────    │
│  [Exchange Rate]        │   Pay to: ...              │
│  [Transfer Fee]         │   Pay Period: ...          │
│  [Bonus Override]       │   Email: ...               │
│                         │   ─────────────────────    │
│  [Generate Button]      │   Hours Worked: 36.58      │
│  [Print Button]         │   Agent Rate: $ 4.00       │
│                         │   Bonus: $ —               │
│                         │   Total Pay USD: $ 146.32  │
│                         │   Exchange Rate: 60.22     │
│                         │   Converted PHP: ₱8,811.39 │
│                         │   ─────────────────────    │
│                         │   Deductions               │
│                         │   Transfer Fee: ₱ 10.00    │
│                         │   ─────────────────────    │
│                         │   NET PAY: ₱ 8,801.39      │
│                         │                            │
│                         │   — Please be advised...   │
└─────────────────────────┴────────────────────────────┘
```

### PayslipGenerator Component Spec

```jsx
// components/payslip/PayslipGenerator.jsx
import { useState } from 'react';
import EmployeeSearchDropdown from './EmployeeSearchDropdown';
import PayslipPreview from './PayslipPreview';
import { usePayslip } from '../../hooks/usePayslip';

export default function PayslipGenerator() {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [config, setConfig] = useState({
    payPeriod: 'March 15, 2026 to March 28, 2026',
    exchangeRate: 60.22,
    transferFee: 10.00,
    bonusOverride: ''       // empty means use existing bonus from record
  });

  const { payslip, loading } = usePayslip(selectedEmployee?.id, config);

  const handlePrint = () => window.print();

  return (
    <div className="payslip-layout">
      {/* LEFT PANEL */}
      <div className="form-panel">
        <h2>Generate Payslip</h2>

        <label>Pay to (Employee)</label>
        <EmployeeSearchDropdown
          onSelect={setSelectedEmployee}
          selected={selectedEmployee}
        />

        <label>Pay Period</label>
        <input
          value={config.payPeriod}
          onChange={e => setConfig(p => ({ ...p, payPeriod: e.target.value }))}
        />

        <label>Exchange Rate (PHP / 1 USD)</label>
        <input
          type="number"
          step="0.01"
          value={config.exchangeRate}
          onChange={e => setConfig(p => ({ ...p, exchangeRate: parseFloat(e.target.value) }))}
        />

        <label>Transfer Fee (PHP)</label>
        <input
          type="number"
          step="0.01"
          value={config.transferFee}
          onChange={e => setConfig(p => ({ ...p, transferFee: parseFloat(e.target.value) }))}
        />

        <label>Bonus Override (USD) <span className="hint">— Leave blank to use existing</span></label>
        <input
          type="number"
          step="0.01"
          placeholder="e.g. 20.00"
          value={config.bonusOverride}
          onChange={e => setConfig(p => ({ ...p, bonusOverride: e.target.value }))}
        />

        <button
          className="btn-primary"
          disabled={!selectedEmployee || loading}
          onClick={handlePrint}
        >
          Print / Save as PDF
        </button>
      </div>

      {/* RIGHT PANEL */}
      <div className="preview-panel">
        {payslip
          ? <PayslipPreview data={payslip} />
          : <EmptyState message="Select an employee to preview their payslip." />
        }
      </div>
    </div>
  );
}
```

---

## EmployeeSearchDropdown Component

This is the most critical UI piece. It must have:
- A text input for typing/searching
- A dropdown list that filters by name or email in real time
- A "Browse all" button to open unfiltered dropdown
- A selected state showing the chosen employee's name + email
- A clear/remove button
- Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
- Closes on outside click

```jsx
// components/payslip/EmployeeSearchDropdown.jsx
// Props:
//   selected: Employee | null
//   onSelect: (employee: Employee) => void

import { useState, useEffect, useRef } from 'react';
import { fetchEmployees } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce'; // debounce the API call

export default function EmployeeSearchDropdown({ selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef(null);

  // Fetch employees when query changes
  useEffect(() => {
    setLoading(true);
    fetchEmployees(debouncedQuery)
      .then(res => setResults(res.data))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (emp) => {
    onSelect(emp);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className="employee-dropdown">
      {/* Show selected badge, or search input */}
      {selected ? (
        <div className="selected-employee">
          <div>
            <span className="emp-name">{selected.name}</span>
            <span className="emp-email">{selected.email}</span>
          </div>
          <button className="clear-btn" onClick={handleClear}>✕ Change</button>
        </div>
      ) : (
        <div className="search-row">
          <input
            type="text"
            placeholder="Search name or email..."
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          <button className="browse-btn" onClick={() => { setQuery(''); setOpen(o => !o); }}>
            ▾ Browse
          </button>
        </div>
      )}

      {/* Dropdown list */}
      {open && !selected && (
        <ul className="dropdown-list">
          {loading && <li className="state-item">Searching...</li>}
          {!loading && results.length === 0 && <li className="state-item">No employees found.</li>}
          {results.map(emp => (
            <li key={emp.id} className="dropdown-item" onClick={() => handleSelect(emp)}>
              <span className="item-name">{emp.name}</span>
              <span className="item-email">{emp.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## PayslipPreview Component

This is the printable payslip. It must look **identical to the physical payslip** shown in the design reference.

```jsx
// components/payslip/PayslipPreview.jsx
// Props: data: PayslipData

import { formatPHP, formatUSD } from '../../utils/formatCurrency';

export default function PayslipPreview({ data }) {
  return (
    <div className="payslip-card" id="payslip-print-area">

      {/* Header — DMA Logo + Company Name */}
      <div className="ps-header">
        <img src="/dma-logo.png" alt="DMA Global Accounting Services" className="ps-logo" />
        {/* If no image, use text: */}
        {/* <div className="ps-company">DMA Global Accounting Services, Co.</div> */}
      </div>

      {/* Recipient Info */}
      <div className="ps-section ps-recipient">
        <div className="ps-field-row">
          <span className="ps-label">Pay to:</span>
          <span className="ps-value">{data.payTo}</span>
        </div>
        <div className="ps-field-row">
          <span className="ps-label">Pay Period:</span>
          <span className="ps-value">{data.payPeriod}</span>
        </div>
        <div className="ps-field-row">
          <span className="ps-label">Email Address:</span>
          <span className="ps-value">{data.emailAddress}</span>
        </div>
      </div>

      <hr className="ps-divider" />

      {/* Earnings */}
      <div className="ps-section ps-earnings">
        <div className="ps-field-row">
          <span className="ps-label">Hours Worked</span>
          <span className="ps-value">{data.hoursWorked.toFixed(2)}</span>
        </div>
        <div className="ps-field-row">
          <span className="ps-label">Agent Rate</span>
          <span className="ps-value">
            <span className="currency-symbol">$</span> {data.agentRate.toFixed(2)}
          </span>
        </div>
        <div className="ps-field-row">
          <span className="ps-label">Bonus</span>
          <span className="ps-value">
            <span className="currency-symbol">$</span>
            {data.bonus > 0 ? data.bonus.toFixed(2) : ' —'}
          </span>
        </div>
        <div className="ps-field-row">
          <span className="ps-label">Total Pay in USD</span>
          <span className="ps-value">
            <span className="currency-symbol">$</span> {data.totalPayUSD.toFixed(2)}
          </span>
        </div>
        <div className="ps-field-row">
          <span className="ps-label">Current Exchange Rate</span>
          <span className="ps-value">
            {data.currentExchangeRate.toFixed(2)}
            <span className="ps-note"> (PHP / 1USD)</span>
          </span>
        </div>
        <div className="ps-field-row">
          <span className="ps-label">Converted Pay in PHP</span>
          <span className="ps-value ps-php">
            <span className="currency-symbol">₱</span>
            {' '}{formatPHP(data.convertedPayPHP)}
          </span>
        </div>
      </div>

      {/* Deductions */}
      <div className="ps-section ps-deductions">
        <span className="ps-section-title">Deductions</span>
        <div className="ps-field-row">
          <span className="ps-label">Transfer Fee</span>
          <span className="ps-value">
            <span className="currency-symbol">₱</span> {data.deductions.transferFee.toFixed(2)}
          </span>
        </div>
      </div>

      <hr className="ps-divider ps-divider--bold" />

      {/* Net Pay */}
      <div className="ps-section ps-net-pay">
        <span className="ps-net-label">NET PAY</span>
        <span className="ps-net-value">
          ₱ {formatPHP(data.netPay)}
        </span>
      </div>

      {/* Footer note */}
      <p className="ps-footer-note">
        — Please be advised that a transfer fee will be deducted for payments
        processed through bank transfer.
      </p>
    </div>
  );
}
```

---

## Print / PDF Support

```jsx
// components/payslip/PayslipPrintWrapper.jsx
// Wrap the PayslipPreview in a print-only layout

export default function PayslipPrintWrapper({ children }) {
  return (
    <div className="print-wrapper">
      {children}
    </div>
  );
}
```

Add this to your global CSS or a `print.css`:

```css
@media print {
  /* Hide everything except the payslip */
  body * {
    visibility: hidden;
  }
  #payslip-print-area,
  #payslip-print-area * {
    visibility: visible;
  }
  #payslip-print-area {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }

  /* Hide nav, sidebar, buttons */
  .form-panel,
  .navbar,
  .sidebar,
  button {
    display: none !important;
  }
}
```

---

## Utility Functions

```js
// utils/formatCurrency.js

export const formatPHP = (amount) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

export const formatUSD = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
```

```js
// utils/calculatePay.js
// Use these if you need to do client-side calculation as a fallback
// or for real-time preview before hitting the API

export const calculatePay = ({ totalHours, rate, bonus = 0, exchangeRate, transferFee }) => {
  const pay = totalHours * rate;
  const totalPayUSD = pay + bonus;
  const convertedPayPHP = totalPayUSD * exchangeRate;
  const netPay = convertedPayPHP - transferFee;
  return { pay, totalPayUSD, convertedPayPHP, netPay };
};
```

```js
// hooks/useDebounce.js
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

---

## Constants

```js
// constants/payroll.js

export const DEFAULT_EXCHANGE_RATE = 60.22;
export const DEFAULT_TRANSFER_FEE = 10.00;
export const DEFAULT_PAY_PERIOD = 'March 15, 2026 to March 28, 2026';

export const PAYROLL_COLUMNS = [
  { key: 'name',        label: 'Name',           align: 'left' },
  { key: 'email',       label: 'Email Address',  align: 'left' },
  { key: 'totalHours',  label: 'Total Hours',    align: 'right' },
  { key: 'rate',        label: 'Rate',           align: 'right', prefix: '$' },
  { key: 'pay',         label: 'Pay',            align: 'right' },
  { key: 'bonus',       label: 'Bonus',          align: 'right' },
  { key: 'totalPay',    label: 'Total Pay',      align: 'right' },
  { key: 'exchangeRate',label: 'Ex Rate',        align: 'right' },
  { key: 'totalPhpPay', label: 'Total PHP Pay',  align: 'right', prefix: '₱', accent: true }
];
```

---

## Routing (React Router)

```jsx
// App.jsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import PayrollPage from './pages/PayrollPage';
import PayslipPage from './pages/PayslipPage';

export default function App() {
  return (
    <BrowserRouter>
      <nav>
        <NavLink to="/payroll">Payroll Report</NavLink>
        <NavLink to="/payslip">Generate Payslip</NavLink>
      </nav>
      <Routes>
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/payslip" element={<PayslipPage />} />
        <Route path="/" element={<PayrollPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Key UX Requirements (Must Implement)

| Feature | Where | Notes |
|---|---|---|
| Employee search dropdown | PayslipGenerator | Type-to-filter + Browse button |
| Real-time payslip preview | PayslipGenerator | Updates as inputs change |
| Print / Save as PDF | PayslipGenerator | Uses `window.print()` with CSS `@media print` |
| Column 9 accent color | PayrollTable | Blue/teal for Total PHP Pay |
| Config banner (yellow) | PayrollPage | Matches Excel header style |
| Bonus shown as `—` if 0 | PayslipPreview, PayrollTable | Not "0.00", blank or dash |
| Bonus override field | PayslipGenerator | Optional, overrides employee record |
| Responsive layout | Both pages | Mobile: stacked, Desktop: side-by-side |

---

## Environment Variables

```env
# .env
REACT_APP_API_BASE_URL=http://localhost:8080/api
```

---

## Notes for Backend Collaboration

Tell your Spring Boot developer you need these endpoints:

```
GET  /api/employees?search=anna          → Employee[]
GET  /api/payroll?payPeriod=...          → { config, employees[] }
GET  /api/payslip/:id?payPeriod=...      → PayslipData
POST /api/payslip/generate               → PayslipData (with bonusOverride support)
```

All monetary responses should be **raw numbers** (not pre-formatted strings). Format on the frontend using `formatPHP()` and `formatUSD()`.

---

*Last updated: April 2026 · DMA Global Accounting Services Payslip System*
