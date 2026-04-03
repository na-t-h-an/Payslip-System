import { useState, useEffect } from "react";
import { fetchEmployees } from "../services/api";
import { useDebounce } from "./useDebounce";

export function useEmployees(search = "") {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // We use debounce so we don't spam the Spring Boot server every time you type a letter
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const getEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchEmployees(debouncedSearch);
        // Set real data from your DB
        setEmployees(res.data);
      } catch (err) {
        // Capture the real error (like that 401 we're fixing)
        setError(err.response?.data?.message || "Failed to fetch employees");
        console.error("Employee API Error:", err);
      } finally {
        setLoading(false);
      }
    };

    getEmployees();
  }, [debouncedSearch]);

  return { employees, loading, error, setEmployees };
}