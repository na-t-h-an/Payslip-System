package com.payslip.payroll.repository;

import com.payslip.payroll.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Optional<Employee> findByEmail(String email);
    List<Employee> findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String name, String email);
}