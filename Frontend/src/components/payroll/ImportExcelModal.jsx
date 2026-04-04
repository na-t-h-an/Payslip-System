import { useState, useRef, useCallback } from 'react';
import { bulkImportEmployees } from '../../services/api';

function mapHeader(raw) {
  const h = raw.toString().trim().toLowerCase().replace(/\s+/g, ' ');
  if (['name', 'full name', 'fullname', 'employee name'].includes(h)) return 'fullName';
  if (['email', 'email address'].includes(h)) return 'email';
  if (['total hours', 'hours', 'totalhours'].includes(h)) return 'totalHours';
  if (['rate', 'hourly rate', 'agent rate'].includes(h)) return 'rate';
  if (['bonus'].includes(h)) return 'bonus';
  if (['account number', 'accountnumber', 'account no', 'account no.', 'account'].includes(h)) return 'accountNumber';
  return null;
}

function cleanNum(val) {
  if (val === '' || val === null || val === undefined) return '';
  return val.toString().replace(/[$,\s]/g, '').trim();
}

function parseSheet(workbook, sheetName) {
  const { utils } = window._XLSX_;
  const sheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) return [];

  // Find the header row — first row where at least one cell matches a known field
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some(cell => cell && mapHeader(cell) !== null)) { headerIdx = i; break; }
  }

  const fieldMap = rows[headerIdx].map(mapHeader);

  return rows.slice(headerIdx + 1).map((row, i) => {
    const obj = { _row: headerIdx + i + 2 };
    fieldMap.forEach((field, idx) => {
      if (!field) return;
      const raw = row[idx] ?? '';
      obj[field] = (field === 'totalHours' || field === 'rate' || field === 'bonus')
        ? cleanNum(raw)
        : raw;
    });
    return obj;
  }).filter(r => r.fullName || r.email);
}

function validate(row) {
  const errors = [];
  if (!row.fullName?.toString().trim()) errors.push('Name required');
  if (!row.email?.toString().trim()) errors.push('Email required');
  else if (!row.email.toString().includes('@')) errors.push('Invalid email');
  if (!row.totalHours || Number(row.totalHours) < 0) errors.push('Hours required (≥ 0)');
  else if (isNaN(Number(row.totalHours))) errors.push('Hours must be a number');
  if (!row.rate || Number(row.rate) <= 0) errors.push('Rate required (> 0)');
  else if (isNaN(Number(row.rate))) errors.push('Rate must be a number');
  return errors;
}

export default function ImportExcelModal({ companyId, onImported, onClose }) {
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [rows, setRows] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [fileError, setFileError] = useState(null);
  const inputRef = useRef();

  const loadXLSX = async () => {
    if (window._XLSX_) return window._XLSX_;
    const mod = await import('xlsx');
    window._XLSX_ = mod;
    return mod;
  };

  const applySheet = useCallback((wb, sheetName) => {
    const parsed = parseSheet(wb, sheetName);
    if (parsed.length === 0) {
      setFileError('No data rows found in this sheet. Try another sheet or check the format.');
      setRows(null);
    } else {
      setFileError(null);
      setRows(parsed);
    }
  }, []);

  const processFile = useCallback(async (file) => {
    setFileError(null);
    setRows(null);
    setResult(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setFileError('Please upload an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    const xlsx = await loadXLSX();
    const buf = await file.arrayBuffer();
    const wb = xlsx.read(buf, { type: 'array' });
    setWorkbook(wb);
    setSheetNames(wb.SheetNames);
    const first = wb.SheetNames[0];
    setSelectedSheet(first);
    applySheet(wb, first);
  }, [applySheet]);

  const handleSheetChange = (sheetName) => {
    setSelectedSheet(sheetName);
    applySheet(workbook, sheetName);
  };

  const resetFile = () => {
    setRows(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setFileError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const validRows = rows?.filter(r => validate(r).length === 0) ?? [];
  const invalidRows = rows?.filter(r => validate(r).length > 0) ?? [];

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    try {
      const payload = validRows.map(r => ({
        companyId,
        fullName: r.fullName.toString().trim(),
        email: r.email.toString().trim().toLowerCase(),
        totalHours: Number(r.totalHours) || 0,
        rate: Number(r.rate),
        bonus: Number(r.bonus) || 0,
        accountNumber: r.accountNumber?.toString().trim() || null,
      }));
      const res = await bulkImportEmployees(companyId, payload);
      setResult(res.data);
      onImported();
    } catch (err) {
      setFileError(err?.response?.data?.error || err?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Import Employees from Excel</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Columns: <span className="font-medium">Name, Email, Total Hours, Rate, Bonus, Account Number</span> (Bonus &amp; Account Number optional)
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh] p-6 space-y-4">

          {/* Success state */}
          {result ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">Import Successful</p>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium text-green-600">{result.created} created</span>
                  {' · '}
                  <span className="font-medium text-blue-600">{result.updated} updated</span>
                  {' · '}
                  {result.total} total
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Drop zone — only shown before a file is loaded */}
              {!workbook && (
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => inputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
                    dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                      {dragging ? 'Drop your file here' : 'Drag & drop your Excel file here'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">or click to browse — .xlsx, .xls, .csv</p>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => processFile(e.target.files[0])}
                  />
                </div>
              )}

              {/* Sheet selector — shown when file has multiple sheets */}
              {workbook && sheetNames.length > 1 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-600">
                    This file has {sheetNames.length} sheets — select which one to import:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sheetNames.map(name => (
                      <button
                        key={name}
                        onClick={() => handleSheetChange(name)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedSheet === name
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* File error */}
              {fileError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {fileError}
                </div>
              )}

              {/* Preview */}
              {rows && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Preview — {rows.length} row{rows.length !== 1 ? 's' : ''} found
                      {invalidRows.length > 0 && (
                        <span className="ml-2 text-red-500">({invalidRows.length} invalid, will be skipped)</span>
                      )}
                    </p>
                    <button onClick={resetFile} className="text-xs text-blue-600 hover:underline">
                      Change file
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-right">Hours</th>
                          <th className="px-3 py-2 text-right">Rate</th>
                          <th className="px-3 py-2 text-right">Bonus</th>
                          <th className="px-3 py-2 text-left">Account No.</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((row) => {
                          const errs = validate(row);
                          const ok = errs.length === 0;
                          return (
                            <tr key={row._row} className={ok ? '' : 'bg-red-50'}>
                              <td className="px-3 py-2 text-gray-400">{row._row}</td>
                              <td className="px-3 py-2 font-medium text-gray-800">{row.fullName || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{row.email || '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{row.totalHours || '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{row.rate || '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{row.bonus || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{row.accountNumber || '—'}</td>
                              <td className="px-3 py-2">
                                {ok ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Valid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" title={errs.join(', ')}>
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {errs[0]}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {rows && !result && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-xs text-gray-500">
              {validRows.length} of {rows.length} row{rows.length !== 1 ? 's' : ''} will be imported
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!validRows.length || importing}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import {validRows.length} Employee{validRows.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
