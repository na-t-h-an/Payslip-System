package com.payslip.payroll.repository;

import com.payslip.payroll.entity.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PayslipRepository extends JpaRepository<Payslip, Long> {
    List<Payslip> findByPayPeriod(String payPeriod);
    List<Payslip> findByPayPeriodId(Long payPeriodId);
    List<Payslip> findByEmployeeId(Long employeeId);
}