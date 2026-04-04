package com.payslip.payroll.controller;

import com.payslip.payroll.entity.Payslip;
import com.payslip.payroll.repository.EmployeeRepository;
import com.payslip.payroll.repository.PayPeriodRepository;
import com.payslip.payroll.repository.PayslipRepository;
import com.payslip.payroll.repository.WhitelistRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payslip")
public class PayslipController {

    private final EmployeeRepository employeeRepo;
    private final PayPeriodRepository payPeriodRepo;
    private final PayslipRepository payslipRepo;
    private final WhitelistRepository whitelistRepo;

    public PayslipController(EmployeeRepository employeeRepo,
                             PayPeriodRepository payPeriodRepo,
                             PayslipRepository payslipRepo,
                             WhitelistRepository whitelistRepo) {
        this.employeeRepo = employeeRepo;
        this.payPeriodRepo = payPeriodRepo;
        this.payslipRepo = payslipRepo;
        this.whitelistRepo = whitelistRepo;
    }

    // GET /api/payslip/sent-status?payPeriodId=X
    // Returns list of employee IDs whose payslip was sent for this pay period
    @GetMapping("/sent-status")
    public ResponseEntity<?> getSentStatus(
            @RequestParam Long payPeriodId,
            @AuthenticationPrincipal Jwt jwt) {
        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }
        List<Long> sentIds = payslipRepo.findByPayPeriodId(payPeriodId).stream()
                .filter(p -> p.getSentAt() != null)
                .map(p -> p.getEmployee().getId())
                .collect(Collectors.toList());
        return ResponseEntity.ok(sentIds);
    }

    // POST /api/payslip/generate
    // Creates a Payslip record in the database and returns its ID
    @PostMapping("/generate")
    public ResponseEntity<?> generatePayslip(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String accountantEmail = jwt.getClaimAsString("email");
        if (!whitelistRepo.existsById(accountantEmail)) {
            return ResponseEntity.status(403).body(Map.of("error", "Unauthorized access."));
        }

        try {
            Long employeeId = Long.valueOf(body.get("employeeId").toString());
            Long payPeriodId = Long.valueOf(body.get("payPeriodId").toString());
            BigDecimal totalHours = new BigDecimal(body.get("totalHours").toString());
            BigDecimal rate = new BigDecimal(body.get("rate").toString());
            BigDecimal bonus = new BigDecimal(body.getOrDefault("bonus", "0").toString());
            BigDecimal totalPhpPay = new BigDecimal(body.get("totalPhpPay").toString());

            var employee = employeeRepo.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Employee not found: " + employeeId));
            var period = payPeriodRepo.findById(payPeriodId)
                .orElseThrow(() -> new RuntimeException("Pay period not found: " + payPeriodId));

            // Upsert: update existing record for this employee+period, or create new
            Payslip payslip = payslipRepo
                .findByEmployeeIdAndPayPeriodId(employeeId, payPeriodId)
                .orElseGet(Payslip::new);

            payslip.setEmployee(employee);
            payslip.setPayPeriod(period);
            payslip.setTotalHours(totalHours);
            payslip.setRateAtTime(rate);
            payslip.setBonus(bonus);
            payslip.setTotalPhpPay(totalPhpPay);

            Payslip saved = payslipRepo.save(payslip);
            return ResponseEntity.ok(Map.of("id", saved.getId()));

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to generate payslip: " + e.getMessage()));
        }
    }
}
