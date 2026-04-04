package com.payslip.payroll.repository;

import com.payslip.payroll.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Optional<Employee> findByEmail(String email);
    List<Employee> findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String name, String email);

    List<Employee> findByCompanyId(Long companyId);

    @Query("SELECT e FROM Employee e WHERE e.company.id = :companyId AND (LOWER(e.fullName) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(e.email) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<Employee> searchByCompanyId(@Param("companyId") Long companyId, @Param("q") String query);

    Optional<Employee> findByEmailAndCompanyId(String email, Long companyId);
}
