package com.payslip.payroll.controller;

import com.payslip.payroll.entity.Payslip;
import com.payslip.payroll.entity.PayPeriod; 
import com.payslip.payroll.repository.PayslipRepository;
import com.payslip.payroll.repository.WhitelistRepository;
import com.payslip.payroll.repository.PayPeriodRepository; 
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {

    private final PayslipRepository payslipRepo;
    private final WhitelistRepository whitelistRepo;
    private final PayPeriodRepository periodRepo;

    public PayrollController(PayslipRepository payslipRepo, 
                             WhitelistRepository whitelistRepo,
                             PayPeriodRepository periodRepo) {
        this.payslipRepo = payslipRepo;
        this.whitelistRepo = whitelistRepo;
        this.periodRepo = periodRepo;
    }

    @GetMapping
    public ResponseEntity<?> getPayrollReport(@RequestParam String payPeriod, @AuthenticationPrincipal Jwt jwt) {
        String email = jwt.getClaimAsString("email");

        if (!whitelistRepo.existsById(email)) {
            return ResponseEntity.status(403).body("Unauthorized: " + email);
        }

        // 1. Parse the string into dates
        String[] dates = payPeriod.split(" to ");
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH);
        LocalDate start = LocalDate.parse(dates[0], formatter);
        LocalDate end = LocalDate.parse(dates[1], formatter);

        // 2. Find the configuration in your pay_periods table
        PayPeriod config = periodRepo.findByStartDateAndEndDate(start, end)
            .orElseGet(() -> {
                PayPeriod newPeriod = new PayPeriod();
                newPeriod.setStartDate(start);
                newPeriod.setEndDate(end);
                newPeriod.setExchangeRate(new BigDecimal("56.0000"));
                newPeriod.setTransferFee(new BigDecimal("15.0000"));
                return newPeriod;
            });

        // 3. Fetch the payslips using the ID (Fixes the red error)
        List<Payslip> payslips;
        if (config.getId() != null) {
            payslips = payslipRepo.findByPayPeriodId(config.getId());
        } else {
            payslips = new java.util.ArrayList<>();
        }

        // 4. Return the data to React
        Map<String, Object> response = new HashMap<>();
        response.put("config", config);
        response.put("employees", payslips);

        return ResponseEntity.ok(response);
    }
}