package com.payslip.payroll.repository;

import com.payslip.payroll.entity.PayPeriod;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PayPeriodRepository extends JpaRepository<PayPeriod, Long> {}