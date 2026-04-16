package com.payslip.payroll.controller;

import com.payslip.payroll.entity.Company;
import com.payslip.payroll.entity.PayPeriod;
import com.payslip.payroll.repository.CompanyRepository;
import com.payslip.payroll.repository.PayPeriodRepository;
import com.payslip.payroll.repository.WhitelistRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/pay-period")
public class PayPeriodController {

    private final PayPeriodRepository periodRepo;
    private final CompanyRepository companyRepo;
    private final WhitelistRepository whitelistRepo;

    public PayPeriodController(PayPeriodRepository periodRepo,
                               CompanyRepository companyRepo,
                               WhitelistRepository whitelistRepo) {
        this.periodRepo = periodRepo;
        this.companyRepo = companyRepo;
        this.whitelistRepo = whitelistRepo;
    }

    // GET /api/pay-period/latest?companyId=1
    @GetMapping("/latest")
    public ResponseEntity<?> getLatestPayPeriod(
            @RequestParam Long companyId,
            @AuthenticationPrincipal Jwt jwt) {
        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }
        return periodRepo.findFirstByCompanyIdOrderByIdDesc(companyId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.ok().build());
    }

    // GET /api/pay-period?startDate=2026-04-01&endDate=2026-04-14&companyId=1
    @GetMapping
    public ResponseEntity<?> getPayPeriod(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam Long companyId,
            @AuthenticationPrincipal Jwt jwt) {
        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }
        return periodRepo.findByCompanyIdAndStartDateAndEndDate(
                companyId, LocalDate.parse(startDate), LocalDate.parse(endDate))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.ok().build());
    }

    // POST /api/pay-period
    @PostMapping
    public ResponseEntity<?> savePayPeriod(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }

        Long companyId = Long.valueOf(body.get("companyId").toString());
        LocalDate start = LocalDate.parse((String) body.get("startDate"));
        LocalDate end = LocalDate.parse((String) body.get("endDate"));
        BigDecimal exchangeRate = new BigDecimal(body.get("exchangeRate").toString());
        BigDecimal transferFee = body.containsKey("transferFee") && body.get("transferFee") != null
                ? new BigDecimal(body.get("transferFee").toString()) : BigDecimal.ZERO;

        Company company = companyRepo.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        PayPeriod period = periodRepo.findByCompanyIdAndStartDateAndEndDate(companyId, start, end)
                .orElseGet(PayPeriod::new);

        period.setCompany(company);
        period.setStartDate(start);
        period.setEndDate(end);
        period.setExchangeRate(exchangeRate);
        period.setTransferFee(transferFee);

        return ResponseEntity.ok(periodRepo.save(period));
    }
}
