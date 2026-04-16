/**
 * Applies formula definitions to an employee's raw imported data.
 *
 * @param {Array}  columnDefs  Non-identity columns from company.columnMappings
 *                             Each may have an optional `formula` field.
 * @param {Object} rawData     Parsed employee.customData — { "TOTAL HOURS": 85.5, "RATE": 9, ... }
 * @returns {Object}           rawData merged with any formula-computed overrides
 */
export function evaluateCustomColumns(columnDefs, rawData) {
  if (!columnDefs || columnDefs.length === 0) return rawData;
  const result = { ...rawData };

  for (const col of columnDefs) {
    if (!col.formula) continue; // no formula — keep raw imported value
    try {
      const val = evaluateFormula(col.formula, result);
      if (val != null && !isNaN(val)) result[col.key] = val;
    } catch { /* keep raw value on error */ }
  }

  return result;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function applyOp(a, op, b) {
  switch (op) {
    case '*': return a * b;
    case '+': return a + b;
    case '-': return a - b;
    case '/': return b !== 0 ? a / b : 0;
    default:  return a;
  }
}

function getTermVal(term, fields) {
  switch (term.type) {
    case 'field': {
      const raw = fields[term.field] ?? 0;
      // Strip currency symbols/commas in case the value was stored as formatted string
      const n = Number(typeof raw === 'string' ? raw.replace(/[₱$,\s]/g, '') : raw);
      return isNaN(n) ? 0 : n;
    }
    case 'number': return Number(term.value ?? 0);
    case 'pct':    return Number(term.value ?? 0) / 100;
    default:       return 0;
  }
}

function evaluateFormula(formula, fields) {
  if (!formula) return null;

  // ── Term-chain format { terms: [...] } ───────────────────────────────────────
  if (Array.isArray(formula.terms) && formula.terms.length > 0) {
    let val = getTermVal(formula.terms[0], fields);
    for (let i = 1; i < formula.terms.length; i++) {
      const t = formula.terms[i];
      val = applyOp(val, t.op ?? '*', getTermVal(t, fields));
    }
    return val;
  }

  // ── Legacy formats (backward compat) ─────────────────────────────────────────
  switch (formula.type) {
    case 'fieldXfield': {
      const a = Number(fields[formula.a] ?? 0);
      const b = Number(fields[formula.b] ?? 0);
      return applyOp(a, formula.op ?? '*', b);
    }
    case 'fieldXpct': {
      return Number(fields[formula.field] ?? 0) * (Number(formula.pct) / 100);
    }
    case 'combo': {
      const a = Number(fields[formula.a] ?? 0);
      const b = Number(fields[formula.b] ?? 0);
      const base = applyOp(a, formula.op ?? '*', b);
      const pctResult = base * (Number(formula.pct) / 100);
      if (formula.extraOp && formula.extraField) {
        return applyOp(pctResult, formula.extraOp, Number(fields[formula.extraField] ?? 0));
      }
      return pctResult;
    }
    default: return null;
  }
}
