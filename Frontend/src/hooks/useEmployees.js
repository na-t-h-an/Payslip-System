import { useState, useEffect } from 'react';
import { fetchEmployees } from '../services/api';
import { MOCK_EMPLOYEES } from '../data/mockData';
import { useDebounce } from './useDebounce';

export function useEmployees(search = '') {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchEmployees(debouncedSearch)
      .then(res => setEmployees(res.data))
      .catch(() => {
        const filtered = MOCK_EMPLOYEES.filter(emp =>
          emp.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          emp.email.toLowerCase().includes(debouncedSearch.toLowerCase())
        );
        setEmployees(filtered);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  return { employees, loading, error };
}
