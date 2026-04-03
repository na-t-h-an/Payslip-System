package com.payslip.payroll.repository;

import com.payslip.payroll.entity.PayPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;

public interface PayPeriodRepository extends JpaRepository<PayPeriod, Long> {
    Optional<PayPeriod> findByStartDateAndEndDate(LocalDate startDate, LocalDate endDate);
}