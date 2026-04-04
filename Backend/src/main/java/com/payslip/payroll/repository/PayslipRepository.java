package com.payslip.payroll.repository;

import com.payslip.payroll.entity.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PayslipRepository extends JpaRepository<Payslip, Long> {
    List<Payslip> findByPayPeriodId(Long payPeriodId);
    List<Payslip> findByEmployeeId(Long employeeId);
    Optional<Payslip> findByEmployeeIdAndPayPeriodId(Long employeeId, Long payPeriodId);
}