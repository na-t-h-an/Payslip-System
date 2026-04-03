package com.payslip.payroll.repository;

import com.payslip.payroll.entity.Whitelist;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WhitelistRepository extends JpaRepository<Whitelist, String> {}