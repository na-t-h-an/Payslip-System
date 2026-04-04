package com.payslip.payroll.controller;

import com.payslip.payroll.repository.PayslipRepository;
import com.payslip.payroll.repository.WhitelistRepository;
import com.payslip.payroll.service.EmailService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/payslip")
public class PayslipEmailController {

    private final EmailService emailService;
    private final WhitelistRepository whitelistRepo;
    private final PayslipRepository payslipRepo;

    public PayslipEmailController(EmailService emailService,
                                  WhitelistRepository whitelistRepo,
                                  PayslipRepository payslipRepo) {
        this.emailService = emailService;
        this.whitelistRepo = whitelistRepo;
        this.payslipRepo = payslipRepo;
    }

    @PostMapping("/send-email")
    public ResponseEntity<Map<String, String>> sendPayslipEmail(
            @RequestParam("email") String employeeEmail,
            @RequestParam("name") String employeeName,
            @RequestParam("payPeriod") String payPeriod,
            @RequestParam("pdf") MultipartFile pdf,
            @RequestParam(value = "employeeId", required = false) Long employeeId,
            @RequestParam(value = "payPeriodId", required = false) Long payPeriodId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        try {
            String accountantEmail = jwt.getClaimAsString("email");
            var metadata = jwt.getClaimAsMap("user_metadata");
            String accountantName = (metadata != null && metadata.containsKey("full_name"))
                                    ? metadata.get("full_name").toString()
                                    : accountantEmail;

            if (!whitelistRepo.existsById(accountantEmail)) {
                return ResponseEntity.status(403).body(Map.of("error", "Unauthorized access."));
            }

            emailService.sendPayslipWithAttachment(
                employeeEmail,
                accountantEmail,
                accountantName,
                employeeName,
                payPeriod,
                pdf.getBytes()
            );

            // Mark payslip as sent
            if (employeeId != null && payPeriodId != null) {
                payslipRepo.findByEmployeeIdAndPayPeriodId(employeeId, payPeriodId)
                    .ifPresent(p -> {
                        p.setSentAt(LocalDateTime.now());
                        p.setSentBy(accountantEmail);
                        payslipRepo.save(p);
                    });
            }

            return ResponseEntity.ok(Map.of("message", "Payslip sent by " + accountantName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to send: " + e.getMessage()));
        }
    }
}