package com.payslip.payroll.controller;

import com.payslip.payroll.entity.Employee;
import com.payslip.payroll.entity.PayPeriod;
import com.payslip.payroll.repository.EmployeeRepository;
import com.payslip.payroll.repository.PayPeriodRepository;
import com.payslip.payroll.repository.WhitelistRepository;
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
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {

    private final EmployeeRepository employeeRepo;
    private final WhitelistRepository whitelistRepo;
    private final PayPeriodRepository periodRepo;

    public PayrollController(EmployeeRepository employeeRepo,
                             WhitelistRepository whitelistRepo,
                             PayPeriodRepository periodRepo) {
        this.employeeRepo = employeeRepo;
        this.whitelistRepo = whitelistRepo;
        this.periodRepo = periodRepo;
    }

    @GetMapping
    public ResponseEntity<?> getPayrollReport(
            @RequestParam String payPeriod,
            @AuthenticationPrincipal Jwt jwt) {

        String email = jwt.getClaimAsString("email");
        if (!whitelistRepo.existsById(email)) {
            return ResponseEntity.status(403).body("Unauthorized: " + email);
        }

        // Parse "March 15, 2026 to March 28, 2026"
        String[] parts = payPeriod.split(" to ");
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH);
        LocalDate start = LocalDate.parse(parts[0].trim(), fmt);
        LocalDate end   = LocalDate.parse(parts[1].trim(), fmt);

        // Get or create the pay period config and persist it
        PayPeriod config = periodRepo.findByStartDateAndEndDate(start, end)
            .orElseGet(() -> {
                PayPeriod p = new PayPeriod();
                p.setStartDate(start);
                p.setEndDate(end);
                p.setExchangeRate(new BigDecimal("56.00"));
                p.setTransferFee(new BigDecimal("15.00"));
                return periodRepo.save(p);
            });

        BigDecimal exchangeRate = config.getExchangeRate();

        // Read all active employees and compute payroll values
        List<Map<String, Object>> employees = employeeRepo.findAll().stream()
            .filter(Employee::isActive)
            .map(emp -> {
                BigDecimal bonus    = emp.getBonus()       != null ? emp.getBonus()       : BigDecimal.ZERO;
                BigDecimal hours    = emp.getTotalHours()  != null ? emp.getTotalHours()  : BigDecimal.ZERO;
                BigDecimal rate     = emp.getCurrentRate() != null ? emp.getCurrentRate() : BigDecimal.ZERO;
                BigDecimal pay      = hours.multiply(rate);
                BigDecimal totalPay = pay.add(bonus);
                BigDecimal phpPay   = totalPay.multiply(exchangeRate);

                Map<String, Object> dto = new HashMap<>();
                dto.put("id",           emp.getId());
                dto.put("name",         emp.getFullName());
                dto.put("email",        emp.getEmail());
                dto.put("totalHours",   hours);
                dto.put("rate",         rate);
                dto.put("pay",          pay);
                dto.put("bonus",        bonus);
                dto.put("totalPay",     totalPay);
                dto.put("exchangeRate", exchangeRate);
                dto.put("totalPhpPay",  phpPay);
                return dto;
            })
            .collect(Collectors.toList());

        // Build config response the frontend expects
        Map<String, Object> configDto = new HashMap<>();
        configDto.put("payPeriod",   fmt.format(start) + " to " + fmt.format(end));
        configDto.put("exchangeRate", exchangeRate);
        configDto.put("transferFee",  config.getTransferFee());

        Map<String, Object> response = new HashMap<>();
        response.put("config",    configDto);
        response.put("employees", employees);

        return ResponseEntity.ok(response);
    }
}
