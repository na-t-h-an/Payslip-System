package com.payslip.payroll.controller;

import com.payslip.payroll.repository.WhitelistRepository;
import com.payslip.payroll.service.EmailService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/payslip")
public class PayslipEmailController {

    private final EmailService emailService;
    private final WhitelistRepository whitelistRepo;

    public PayslipEmailController(EmailService emailService, WhitelistRepository whitelistRepo) {
        this.emailService = emailService;
        this.whitelistRepo = whitelistRepo;
    }

    @PostMapping("/send-email")
    public ResponseEntity<Map<String, String>> sendPayslipEmail(
            @RequestParam("email") String employeeEmail,
            @RequestParam("name") String employeeName,
            @RequestParam("payPeriod") String payPeriod,
            @RequestParam("pdf") MultipartFile pdf,
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

            return ResponseEntity.ok(Map.of("message", "Payslip sent by " + accountantName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to send: " + e.getMessage()));
        }
    }
}