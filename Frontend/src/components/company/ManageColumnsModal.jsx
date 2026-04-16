import { useState, useMemo, useEffect } from 'react';
import { updateCompany, fetchEmployees, updateEmployee } from '../../services/api';
import { evaluateCustomColumns } from '../../utils/evaluateCustomColumns';

// ─── Constants ─────────────────────────────────────────────────────────────────

const OPS = [
  { value: '*', label: '×' },
  { value: '+', label: '+' },
  { value: '-', label: '−' },
  { value: '/', label: '÷' },
];

const TERM_TYPES = [
  { value: 'field',  label: 'Column' },
  { value: 'number', label: 'Number' },
  { value: 'pct',    label: 'Percent' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function defaultTerm(numericFields, op) {
  const t = { type: 'field', field: numericFields[0]?.key ?? '' };
  if (op) t.op = op;
  return t;
}

function termLabel(term, numericFields) {
  if (term.type === 'field')  return numericFields.find(f => f.key === term.field)?.label ?? term.field;
  if (term.type === 'pct')    return `${term.value ?? 0}%`;
  return String(term.value ?? 0);
}

function formulaPreview(formula, numericFields) {
  if (!formula || !Array.isArray(formula.terms) || formula.terms.length === 0) return null;
  return formula.terms.map((t, i) => {
    const opStr = i > 0 ? ` ${OPS.find(o => o.value === t.op)?.label ?? t.op} ` : '';
    return opStr + termLabel(t, numericFields);
  }).join('');
}

// ─── Formula Editor ──────────────────────────────────────────────────────────────
// Grid columns: [Operation 130px] [Type 110px] [Value/Column flex] [Remove 28px]

const GRID = 'grid grid-cols-[130px_110px_1fr_28px] items-center gap-3';

function FormulaEditor({ formula, numericFields, onChange }) {
  const terms = formula?.terms?.length > 0 ? formula.terms : [defaultTerm(numericFields)];

  const updateTerm = (idx, t) => onChange({ terms: terms.map((x, i) => i === idx ? t : x) });
  const addTerm    = ()      => onChange({ terms: [...terms, defaultTerm(numericFields, '*')] });
  const removeTerm = (idx)   => onChange({ terms: terms.filter((_, i) => i !== idx) });

  if (numericFields.length === 0) {
    return (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        No numeric columns available to reference in formulas.
      </p>
    );
  }

  const setType = (idx, type) => {
    const t = terms[idx];
    if (type === 'field') updateTerm(idx, { type: 'field', op: t.op, field: numericFields[0]?.key ?? '' });
    else updateTerm(idx, { type, op: t.op, value: 10 });
  };

  return (
    <div className="space-y-1.5">
      {/* Column headers */}
      <div className={GRID}>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Operation</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Value / Column</span>
        <span />
      </div>

      {terms.map((term, idx) => (
        <div key={idx} className={GRID}>
          {/* Operation */}
          {idx === 0 ? (
            <span className="text-xs text-gray-400 italic pl-1">start</span>
          ) : (
            <select value={term.op ?? '*'} onChange={e => updateTerm(idx, { ...term, op: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-1 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-400">
              {OPS.map(o => <option key={o.value} value={o.value}>{o.label} {o.value === '*' ? 'Multiply' : o.value === '+' ? 'Add' : o.value === '-' ? 'Subtract' : 'Divide'}</option>)}
            </select>
          )}

          {/* Type */}
          <select value={term.type ?? 'field'} onChange={e => setType(idx, e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            {TERM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* Value / Column */}
          {term.type === 'field' ? (
            <select value={term.field ?? ''} onChange={e => updateTerm(idx, { ...term, field: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {numericFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          ) : (
            <div className="flex items-center gap-1">
              <input type="number" value={term.value ?? ''} placeholder="0"
                onChange={e => updateTerm(idx, { ...term, value: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              {term.type === 'pct' && <span className="text-sm text-gray-500 shrink-0">%</span>}
            </div>
          )}

          {/* Remove */}
          {idx > 0 ? (
            <button onClick={() => removeTerm(idx)} title="Remove term"
              className="flex items-center justify-center rounded-md border border-red-200 w-6 h-6 text-xs text-red-400 hover:bg-red-50 transition-colors">
              ✕
            </button>
          ) : <span />}
        </div>
      ))}

      <button onClick={addTerm} className="text-xs font-medium text-blue-600 hover:underline mt-1">
        + Add term
      </button>
      <p className="text-xs text-gray-400 italic">
        = <span className="font-mono text-gray-600">{formulaPreview({ terms }, numericFields) ?? '—'}</span>
      </p>
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────────

export default function ManageColumnsModal({ company, onSaved, onClose }) {
  // All column definitions from company — handles both new array format and old object format
  const allDefs = useMemo(() => {
    try {
      const parsed = JSON.parse(company?.columnMappings || '[]');
      if (Array.isArray(parsed)) return parsed;
      // Old object format: { "EXCEL HEADER": "systemField" }
      if (parsed && typeof parsed === 'object') {
        const NUMERIC_SYS = new Set(['totalHours', 'rate', 'bonus', 'transferFee', 'exchangeRate']);
        return Object.entries(parsed)
          .filter(([, field]) => field) // skip unmapped columns (empty string)
          .map(([header, systemField]) => ({
            key:         header,
            label:       header,
            type:        NUMERIC_SYS.has(systemField) ? 'number' : 'text',
            systemField,
            formula:     null,
          }));
      }
      return [];
    } catch { return []; }
  }, [company]);

  // Non-identity columns (editable)
  const [cols, setCols] = useState(() =>
    allDefs.filter(col => !['fullName', 'email'].includes(col.systemField))
  );

  const [expandedKey, setExpandedKey] = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  // All numeric columns as potential formula fields
  const numericFields = useMemo(
    () => cols.filter(c => c.type === 'number').map(c => ({ key: c.key, label: c.label })),
    [cols]
  );

  const updateColFormula = (key, formula) =>
    setCols(prev => prev.map(c => c.key === key ? { ...c, formula } : c));

  const clearFormula = (key) =>
    setCols(prev => prev.map(c => c.key === key ? { ...c, formula: null } : c));

  const toggleCurrency = (key) =>
    setCols(prev => prev.map(c => c.key === key ? { ...c, currency: !c.currency } : c));

  // ── Save & bulk-recalculate ────────────────────────────────────────────────
  const handleSave = async () => {
    setError(null);
    setSaving(true);

    // Merge edited non-identity cols back into full allDefs array
    const colsMap = Object.fromEntries(cols.map(c => [c.key, c]));
    const newAllDefs = allDefs.map(col =>
      colsMap[col.key] ? { ...col, formula: colsMap[col.key].formula, currency: colsMap[col.key].currency } : col
    );
    const newColMappingsJson = JSON.stringify(newAllDefs);

    try {
      await updateCompany(company.id, { columnMappings: newColMappingsJson });
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
      return;
    }

    // Recompute customData for all employees, then notify parent when done
    const nonIdentityCols = newAllDefs.filter(col => !['fullName', 'email'].includes(col.systemField));
    try {
      const empRes = await fetchEmployees(company.id);
      for (const emp of empRes.data) {
        const rawData = (() => { try { return JSON.parse(emp.customData || '{}'); } catch { return {}; } })();
        const computed = evaluateCustomColumns(nonIdentityCols, rawData);
        await updateEmployee(emp.id, {
          companyId:     company.id,
          fullName:      emp.name,
          email:         emp.email,
          totalHours:    emp.totalHours ?? 0,
          rate:          emp.rate ?? 0,
          bonus:         emp.bonus ?? 0,
          bankName:      emp.bankName,
          accountNumber: emp.accountNumber,
          transferFee:   emp.transferFee ?? 0,
          customData:    JSON.stringify(computed),
        });
      }
    } catch { /* non-fatal */ }
    finally {
      setSaving(false);
      // Notify parent after all updates complete so it can refresh employees
      onSaved({ ...company, columnMappings: newColMappingsJson });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const hasColumns = cols.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-xl flex-col rounded-xl bg-white shadow-xl max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Manage Columns</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {company?.name} — add formulas to numeric columns
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-3">

          {!hasColumns ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-gray-400">No imported columns yet.</p>
              <p className="text-xs text-gray-400">Import from Excel first, then return here to add formulas.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Numeric columns can have formulas. Formula results overwrite the imported value for that column. Text columns are read-only.
              </p>

              {cols.map((col) => {
                const isNumeric  = col.type === 'number';
                const hasFormula = isNumeric && col.formula && Array.isArray(col.formula.terms) && col.formula.terms.length > 0;
                const isExpanded = expandedKey === col.key;
                const preview    = hasFormula ? formulaPreview(col.formula, numericFields) : null;

                return (
                  <div key={col.key}
                    className={`rounded-lg border overflow-hidden ${isExpanded ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>

                    {/* Column header row */}
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50">
                      {/* Type badge */}
                      <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold ${
                        isNumeric ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isNumeric ? '123' : 'ABC'}
                      </span>

                      <span className="flex-1 text-sm font-medium text-gray-800 truncate" title={col.label}>
                        {col.label}
                      </span>

                      {/* Formula preview badge */}
                      {hasFormula && !isExpanded && (
                        <span className="hidden sm:block text-xs text-purple-600 font-mono bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 max-w-[160px] truncate">
                          = {preview}
                        </span>
                      )}

                      {isNumeric && (
                        <button
                          onClick={() => toggleCurrency(col.key)}
                          title="Toggle ₱ currency formatting"
                          className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                            col.currency
                              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                              : 'border-gray-300 bg-white text-gray-400 hover:bg-gray-50'
                          }`}>
                          ₱
                        </button>
                      )}
                      {isNumeric ? (
                        <button
                          onClick={() => setExpandedKey(isExpanded ? null : col.key)}
                          className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                            isExpanded
                              ? 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                              : hasFormula
                                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                          }`}>
                          {isExpanded ? 'Collapse' : hasFormula ? 'Edit Formula' : 'Add Formula'}
                        </button>
                      ) : (
                        <span className="shrink-0 text-xs text-gray-400 italic">Text — no formula</span>
                      )}
                    </div>

                    {/* Formula editor — expanded */}
                    {isExpanded && isNumeric && (
                      <div className="px-5 py-4 border-t border-gray-100 bg-white space-y-3">
                        <FormulaEditor
                          formula={col.formula}
                          numericFields={numericFields}
                          onChange={f => updateColFormula(col.key, f)}
                        />
                        {hasFormula && (
                          <button
                            onClick={() => { clearFormula(col.key); setExpandedKey(null); }}
                            className="text-xs text-red-500 hover:underline">
                            Remove formula (revert to imported value)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <button onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !hasColumns}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Saving & recalculating…' : 'Save & Apply to All Employees'}
          </button>
        </div>
      </div>
    </div>
  );
}
