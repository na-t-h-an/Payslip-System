package com.payslip.payroll.controller;

import com.payslip.payroll.entity.PayPeriod;
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
    private final WhitelistRepository whitelistRepo;

    public PayPeriodController(PayPeriodRepository periodRepo, WhitelistRepository whitelistRepo) {
        this.periodRepo = periodRepo;
        this.whitelistRepo = whitelistRepo;
    }

    // GET /api/pay-period/latest
    // Returns the most recently saved pay period config
    @GetMapping("/latest")
    public ResponseEntity<?> getLatestPayPeriod(@AuthenticationPrincipal Jwt jwt) {
        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }
        return periodRepo.findFirstByOrderByIdDesc()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /api/pay-period?startDate=2026-04-01&endDate=2026-04-14
    // Returns saved config for that period, or 404 if not yet created
    @GetMapping
    public ResponseEntity<?> getPayPeriod(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @AuthenticationPrincipal Jwt jwt) {

        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }

        return periodRepo.findByStartDateAndEndDate(LocalDate.parse(startDate), LocalDate.parse(endDate))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // POST /api/pay-period
    // Creates or updates (upsert) the config for a pay period
    @PostMapping
    public ResponseEntity<?> savePayPeriod(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }

        LocalDate start = LocalDate.parse((String) body.get("startDate"));
        LocalDate end   = LocalDate.parse((String) body.get("endDate"));
        BigDecimal exchangeRate = new BigDecimal(body.get("exchangeRate").toString());
        BigDecimal transferFee  = new BigDecimal(body.get("transferFee").toString());

        PayPeriod period = periodRepo.findByStartDateAndEndDate(start, end)
                .orElseGet(PayPeriod::new);

        period.setStartDate(start);
        period.setEndDate(end);
        period.setExchangeRate(exchangeRate);
        period.setTransferFee(transferFee);

        return ResponseEntity.ok(periodRepo.save(period));
    }
}
