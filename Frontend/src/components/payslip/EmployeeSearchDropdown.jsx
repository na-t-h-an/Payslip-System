import { useState, useEffect, useRef } from 'react';
import { useEmployees } from '../../hooks/useEmployees';

export default function EmployeeSearchDropdown({ selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const { employees, loading } = useEmployees(query);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [employees]);

  const handleSelect = (emp) => {
    onSelect(emp);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => (i < employees.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => (i > 0 ? i - 1 : employees.length - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(employees[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div>
          <span className="font-medium text-gray-900">{selected.name}</span>
          <span className="ml-2 text-sm text-gray-500">{selected.email}</span>
        </div>
        <button
          onClick={handleClear}
          className="ml-4 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search name or email..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          onClick={() => { setQuery(''); setOpen(o => !o); }}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Browse
        </button>
      </div>

      {open && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {loading && (
            <li className="px-4 py-3 text-sm text-gray-400">Searching...</li>
          )}
          {!loading && employees.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400">No employees found.</li>
          )}
          {!loading && employees.map((emp, i) => (
            <li
              key={emp.id}
              onClick={() => handleSelect(emp)}
              className={`cursor-pointer px-4 py-3 text-sm transition-colors ${
                i === highlightedIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{emp.name}</span>
              <span className="ml-2 text-gray-400">{emp.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
