import { useState, useRef, useCallback } from 'react';
import { bulkImportEmployees, updateCompany } from '../../services/api';

// ─── Constants ─────────────────────────────────────────────────────────────────

const SYSTEM_FIELDS = [
  { key: 'fullName',      label: 'Employee Name',  identity: true  },
  { key: 'email',         label: 'Email',           identity: true  },
  { key: 'totalHours',    label: 'Total Hours',     identity: false },
  { key: 'rate',          label: 'Rate',            identity: false },
  { key: 'bonus',         label: 'Bonus',           identity: false },
  { key: 'exchangeRate',  label: 'Exchange Rate',   identity: false },
  { key: 'bankName',      label: 'Bank Name',       identity: false },
  { key: 'accountNumber', label: 'Account Number',  identity: false },
  { key: 'transferFee',   label: 'Transfer Fee',    identity: false },
];

const NUMERIC_SYS_FIELDS = new Set(['totalHours', 'rate', 'bonus', 'transferFee', 'exchangeRate']);

// ─── Helpers ────────────────────────────────────────────────────────────────────

function cleanNum(val) {
  if (val === '' || val == null) return '';
  return val.toString().replace(/[₱$,\s]/g, '').trim();
}

function guessSystemField(header) {
  // Normalize: lowercase, strip apostrophes/quotes and other punctuation, collapse spaces
  const h = header.toString().trim().toLowerCase()
    .replace(/[''`]/g, '')           // remove apostrophes ("employee's" → "employees")
    .replace(/[^a-z0-9\s]/g, ' ')   // replace remaining punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
  if (['name', 'full name', 'fullname', 'employee name', 'employees name', 'agent name'].includes(h)) return 'fullName';
  if (['email', 'email address'].includes(h)) return 'email';
  if (['total hours', 'hours', 'totalhours', 'hrs worked', 'hours worked'].includes(h)) return 'totalHours';
  if (['rate', 'hourly rate', 'agent rate', 'daily rate'].includes(h)) return 'rate';
  if (['bonus', 'allowance'].includes(h)) return 'bonus';
  if (['exchange rate', 'exchangerate', 'ex rate', 'exrate', 'ex rate', 'rate of exchange', 'forex rate'].includes(h)) return 'exchangeRate';
  if (['bank name', 'bankname', 'bank'].includes(h)) return 'bankName';
  if (['account number', 'accountnumber', 'account no', 'account no', 'account'].includes(h)) return 'accountNumber';
  if (['transfer fee', 'transferfee', 'fee', 'transfer'].includes(h)) return 'transferFee';
  return '';
}

// Patterns that identify non-data rows (notes, totals, footers)
const METADATA_PATTERN = /^(note[:\s*]|total[s]?\s*$|grand\s+total|subtotal|\*\s*note)/i;

function isDataRow(customData) {
  const vals = Object.values(customData || {});
  const nonEmpty = vals.map(v => String(v ?? '').trim()).filter(v => v !== '');
  if (nonEmpty.length === 0) return false;
  // Skip rows where any cell starts with a metadata keyword
  if (nonEmpty.some(v => METADATA_PATTERN.test(v))) return false;
  return true;
}

function detectColType(values) {
  const nonEmpty = values.filter(v => v !== '' && v != null);
  if (nonEmpty.length === 0) return 'text';
  const numCount = nonEmpty.filter(v => {
    const c = cleanNum(v.toString());
    return c !== '' && !isNaN(Number(c));
  }).length;
  return numCount / nonEmpty.length > 0.7 ? 'number' : 'text';
}

function parseSavedMappings(columnMappings) {
  try {
    const parsed = JSON.parse(columnMappings || 'null');
    if (Array.isArray(parsed)) {
      const map = {};
      parsed.forEach(col => { if (col.systemField) map[col.key] = col.systemField; });
      return map;
    }
    if (parsed && typeof parsed === 'object') return parsed;
    return {};
  } catch { return {}; }
}

function parseSheetData(workbook, sheetName, mapping) {
  const { utils } = window._XLSX_;
  const sheet = workbook.Sheets[sheetName];
  const rawRows = utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawRows.length < 2) return { headers: [], data: [] };

  let headerIdx = 0, maxNonEmpty = 0;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const count = rawRows[i].filter(c => c !== '' && c != null).length;
    if (count > maxNonEmpty) { maxNonEmpty = count; headerIdx = i; }
  }
  const headers = rawRows[headerIdx].map(h => (h ?? '').toString().trim()).filter(h => h !== '');

  const data = rawRows.slice(headerIdx + 1).map((row, i) => {
    const obj = { _row: headerIdx + i + 2, customData: {} };
    headers.forEach((header, idx) => {
      const raw = row[idx] ?? '';
      obj.customData[header] = raw; // ALL columns go into customData
      const sysField = mapping[header];
      if (!sysField) return;
      if (sysField === 'fullName') obj.fullName = raw.toString().trim();
      else if (sysField === 'email') obj.email = raw.toString().trim().toLowerCase();
      else if (NUMERIC_SYS_FIELDS.has(sysField)) obj[sysField] = cleanNum(raw.toString());
      else obj[sysField] = raw.toString().trim();
    });
    return obj;
  }).filter(r => isDataRow(r.customData));

  return { headers, data };
}

function validateRow(row) {
  const errors = [];
  if (row.email?.toString().trim() && !row.email.toString().includes('@')) errors.push('Invalid email');
  return errors;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ImportExcelModal({ company, onImported, onClose }) {
  const companyId = company?.id;

  const [step,          setStep]          = useState('upload');
  const [workbook,      setWorkbook]      = useState(null);
  const [sheetNames,    setSheetNames]    = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [excelHeaders,  setExcelHeaders]  = useState([]);
  const [colTypes,      setColTypes]      = useState({});   // { header: 'number'|'text' }
  const [mapping,       setMapping]       = useState({});   // { header: systemField | '' }
  const [rows,          setRows]          = useState([]);
  const [result,        setResult]        = useState(null);
  const [fileError,     setFileError]     = useState(null);
  const [dragging,      setDragging]      = useState(false);
  const inputRef = useRef();

  // ── XLSX loader ──────────────────────────────────────────────────────────────
  const loadXLSX = async () => {
    if (window._XLSX_) return window._XLSX_;
    const mod = await import('xlsx');
    window._XLSX_ = mod;
    return mod;
  };

  // ── File processing ──────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    setFileError(null);
    setRows([]);
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
    await loadXLSX();
    const buf = await file.arrayBuffer();
    const wb  = window._XLSX_.read(buf, { type: 'array' });
    setWorkbook(wb);
    setSheetNames(wb.SheetNames);
    const first = wb.SheetNames[0];
    setSelectedSheet(first);
    extractHeaders(wb, first);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const extractHeaders = (wb, sheetName) => {
    const { utils } = window._XLSX_;
    const sheet = wb.Sheets[sheetName];
    const rawRows = utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rawRows.length === 0) { setFileError('Empty sheet.'); return; }

    let headerIdx = 0, maxNonEmpty = 0;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const count = rawRows[i].filter(c => c !== '' && c != null).length;
      if (count > maxNonEmpty) { maxNonEmpty = count; headerIdx = i; }
    }
    const headers = rawRows[headerIdx]
      .map(h => (h ?? '').toString().trim())
      .filter(h => h !== '');

    // Detect column types from data rows
    const dataRows = rawRows.slice(headerIdx + 1);
    const types = {};
    headers.forEach((header, idx) => {
      const vals = dataRows.map(r => r[idx]);
      types[header] = detectColType(vals);
    });

    setExcelHeaders(headers);
    setColTypes(types);

    // Pre-fill mapping: saved > guessed > '' (raw data)
    const savedMap = parseSavedMappings(company?.columnMappings);
    const initial = {};
    headers.forEach(h => {
      initial[h] = savedMap[h] ?? guessSystemField(h);
    });
    setMapping(initial);
    setStep('mapper');
  };

  // ── Mapper confirm ───────────────────────────────────────────────────────────
  const confirmMapping = () => {
    if (!workbook) return;
    const { data } = parseSheetData(workbook, selectedSheet, mapping);
    if (data.length === 0) {
      setFileError('No rows found. Make sure the sheet has data rows.');
      return;
    }
    setRows(data);
    setFileError(null);
    setStep('preview');
  };

  // ── Import ───────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    const validRows = rows.filter(r => validateRow(r).length === 0);
    if (!validRows.length) return;
    setStep('importing');

    // Preserve any formulas already added via Manage Columns
    const savedDefs = (() => {
      try {
        const p = JSON.parse(company?.columnMappings || '[]');
        return Array.isArray(p) ? p : [];
      } catch { return []; }
    })();
    const savedFormulas = Object.fromEntries(
      savedDefs.filter(d => d.formula).map(d => [d.key, d.formula])
    );

    // System fields that must always be treated as text regardless of how
    // Excel stored them (e.g. an account number like "12345" stored as a
    // number would otherwise be detected as 'number' and formatted with ₱)
    const FORCE_TEXT_SYS_FIELDS = new Set(['accountNumber', 'bankName']);
    // System fields that are monetary and should display with ₱ in PHP companies
    const CURRENCY_SYS_FIELDS = new Set(['rate', 'bonus', 'transferFee']);

    // Extract exchange rate from the first row that has one mapped.
    // rows[] entries store system-mapped values under their system field key (e.g. rows[0].exchangeRate)
    const hasExRateMapping = excelHeaders.some(h => mapping[h] === 'exchangeRate');
    const importedExchangeRate = hasExRateMapping
      ? (Number(cleanNum(String(rows[0]?.exchangeRate ?? ''))) || null)
      : null;

    // Build new columnMappings array — exclude exchangeRate (pay-period field, not a display column)
    const newColumnMappings = excelHeaders
      .filter(header => mapping[header] !== 'exchangeRate')
      .map(header => {
        const sysField = mapping[header] || null;
        const detectedType = colTypes[header] ?? 'text';
        const colType = FORCE_TEXT_SYS_FIELDS.has(sysField) ? 'text' : detectedType;
        return {
          key:         header,
          label:       header,
          type:        colType,
          // Default currency=true only for known monetary system fields.
          // Non-system numeric columns default false (user can toggle in Manage Columns).
          currency:    colType === 'number' && CURRENCY_SYS_FIELDS.has(sysField),
          systemField: sysField,
          formula:     savedFormulas[header] ?? null,
        };
      });

    try {
      await updateCompany(companyId, { columnMappings: JSON.stringify(newColumnMappings) });
    } catch { /* non-fatal */ }

    const payload = validRows.map(r => ({
      companyId,
      fullName:      r.fullName?.toString().trim() || '',
      email:         r.email?.toString().trim().toLowerCase() || '',
      totalHours:    Number(r.totalHours) || 0,
      rate:          Number(r.rate) || 0,
      bonus:         Number(r.bonus) || 0,
      bankName:      r.bankName?.toString().trim() || null,
      accountNumber: r.accountNumber?.toString().trim() || null,
      transferFee:   Number(r.transferFee) || 0,
      customData:    JSON.stringify(r.customData),
    }));

    let importResult;
    try {
      const res = await bulkImportEmployees(companyId, payload);
      importResult = res.data;
    } catch (err) {
      setFileError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Import failed.');
      setStep('preview');
      return;
    }

    setResult(importResult);
    onImported(importedExchangeRate, JSON.stringify(newColumnMappings));
    setStep('done');
  };

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const onDrop      = useCallback((e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }, [processFile]);
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const resetFile = () => {
    setStep('upload');
    setRows([]);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setExcelHeaders([]);
    setColTypes({});
    setMapping({});
    setFileError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const validRows   = rows.filter(r => validateRow(r).length === 0);
  const invalidRows = rows.filter(r => validateRow(r).length > 0);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'importing') onClose(); }}
    >
      <div className={`flex w-full flex-col rounded-xl bg-white shadow-xl max-h-[90vh] ${step === 'done' || step === 'importing' ? 'max-w-sm' : 'max-w-3xl'}`}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Import Employees from Excel</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'upload'    && 'Upload your Excel or CSV file'}
              {step === 'mapper'    && 'Optionally map name & email — all other data is imported automatically'}
              {step === 'preview'   && `Preview — ${validRows.length} valid, ${invalidRows.length} invalid`}
              {step === 'importing' && 'Importing employees…'}
              {step === 'done'      && 'Import complete'}
            </p>
          </div>
          {step !== 'importing' && (
            <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Step indicator */}
        {step !== 'done' && step !== 'importing' && (
          <div className="flex border-b border-gray-100 px-6 py-2 flex-shrink-0">
            {['upload', 'mapper', 'preview'].map((s, i) => (
              <div key={s} className="flex items-center">
                {i > 0 && <div className="mx-2 h-px w-6 bg-gray-200" />}
                <div className={`flex items-center gap-1.5 text-xs font-medium ${
                  step === s ? 'text-blue-600'
                  : ['upload', 'mapper', 'preview'].indexOf(step) > i ? 'text-green-600'
                  : 'text-gray-400'
                }`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    step === s ? 'bg-blue-600 text-white'
                    : ['upload', 'mapper', 'preview'].indexOf(step) > i ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                  }`}>{i + 1}</span>
                  {s === 'upload' ? 'Upload' : s === 'mapper' ? 'Map Columns' : 'Preview'}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-6 space-y-4">

          {/* ── STEP: Upload ─────────────────────────────────────────────────── */}
          {step === 'upload' && (
            <>
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 transition-colors ${
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
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => processFile(e.target.files[0])} />
              </div>
              {fileError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fileError}</div>
              )}
            </>
          )}

          {/* ── STEP: Column Mapper ──────────────────────────────────────────── */}
          {step === 'mapper' && (
            <>
              {sheetNames.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500 self-center">Sheet:</span>
                  {sheetNames.map(name => (
                    <button key={name} onClick={() => { setSelectedSheet(name); extractHeaders(workbook, name); }}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedSheet === name ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-blue-50'
                      }`}
                    >{name}</button>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                All columns are imported as raw data. Optionally map <strong>Name</strong> and <strong>Email</strong> for employee identification
                — you can add formulas to any numeric column later via <strong>Manage Columns</strong>.
              </div>

              {company?.columnMappings && (
                <p className="text-xs text-green-600 font-medium">✓ Pre-filled from previous import mappings.</p>
              )}

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Excel Column</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">System Field (optional)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {excelHeaders.map(header => {
                      const isIdentity = ['fullName', 'email'].includes(mapping[header]);
                      return (
                        <tr key={header} className={isIdentity ? 'bg-blue-50' : ''}>
                          <td className="px-4 py-2.5 font-medium text-gray-700">{header}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                              colTypes[header] === 'number' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {colTypes[header] === 'number' ? '123' : 'ABC'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={mapping[header] ?? ''}
                              onChange={e => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                              className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                isIdentity ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                              }`}
                            >
                              <option value="">(raw data — import as-is)</option>
                              <optgroup label="Identity — Optional">
                                {SYSTEM_FIELDS.filter(f => f.identity).map(f => (
                                  <option key={f.key} value={f.key}>{f.label}</option>
                                ))}
                              </optgroup>
                              <optgroup label="System Fields — Optional">
                                {SYSTEM_FIELDS.filter(f => !f.identity).map(f => (
                                  <option key={f.key} value={f.key}>{f.label}</option>
                                ))}
                              </optgroup>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {fileError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fileError}</div>
              )}
            </>
          )}

          {/* ── STEP: Preview ────────────────────────────────────────────────── */}
          {step === 'preview' && (
            <>
              {/* Column summary */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Columns to be imported</p>
                <div className="flex flex-wrap gap-1.5">
                  {excelHeaders.map(h => {
                    const sysField = mapping[h];
                    const isIdentity = ['fullName', 'email'].includes(sysField);
                    const isNumeric  = colTypes[h] === 'number';
                    return (
                      <span key={h} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                        isIdentity ? 'bg-blue-100 text-blue-700'
                        : isNumeric ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {h}
                        {sysField && !isIdentity && (
                          <span className="opacity-60">→ {SYSTEM_FIELDS.find(f => f.key === sysField)?.label}</span>
                        )}
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">Blue = identity · Purple = numeric · Gray = text</p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}
                  {invalidRows.length > 0 && (
                    <span className="ml-2 text-red-500">· {invalidRows.length} invalid (will be skipped)</span>
                  )}
                </p>
                <button onClick={() => setStep('mapper')} className="text-xs text-blue-600 hover:underline">
                  ← Back to mapping
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-center">Data Cols</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row) => {
                      const errs = validateRow(row);
                      const ok   = errs.length === 0;
                      return (
                        <tr key={row._row} className={ok ? '' : 'bg-red-50'}>
                          <td className="px-3 py-2 text-gray-400">{row._row}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{row.fullName || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.email || '—'}</td>
                          <td className="px-3 py-2 text-center text-gray-500">
                            {Object.keys(row.customData || {}).length}
                          </td>
                          <td className="px-3 py-2">
                            {ok ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ Valid</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" title={errs.join(', ')}>
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

              {fileError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fileError}</div>
              )}
            </>
          )}

          {/* ── STEP: Importing ──────────────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-5 py-10 px-6 text-center">
              <svg className="h-14 w-14 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-lg font-medium text-gray-700">Importing employees…</p>
            </div>
          )}

          {/* ── STEP: Done ──────────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-5 py-10 px-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-gray-800">Import Successful</p>
                <p className="text-base text-gray-500">
                  <span className="font-semibold text-green-600">{result.created} created</span>
                  {' · '}
                  <span className="font-semibold text-blue-600">{result.updated} updated</span>
                  {' · '}
                  {result.total} total
                </p>
                <p className="text-sm text-purple-600">
                  Use Manage Columns to add formulas to numeric columns.
                </p>
              </div>
              <button onClick={onClose}
                className="rounded-lg bg-blue-600 px-8 py-2.5 text-base font-medium text-white hover:bg-blue-700">
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'mapper' && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 flex-shrink-0">
            <button onClick={resetFile} className="text-sm text-gray-500 hover:underline">← Change file</button>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={confirmMapping}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Next: Preview →
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 flex-shrink-0">
            <p className="text-xs text-gray-500">
              {validRows.length} of {rows.length} row{rows.length !== 1 ? 's' : ''} will be imported
            </p>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleImport}
                disabled={!validRows.length}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import {validRows.length} Employee{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
