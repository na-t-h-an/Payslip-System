package com.payslip.payroll.controller;

import com.payslip.payroll.service.EmailService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/payslip")
public class PayslipEmailController {

    private final EmailService emailService;

    public PayslipEmailController(EmailService emailService) {
        this.emailService = emailService;
    }

    @PostMapping("/send-email")
    public ResponseEntity<Map<String, String>> sendPayslipEmail(
            @RequestParam("email") String email,
            @RequestParam("name") String name,
            @RequestParam("payPeriod") String payPeriod,
            @RequestParam("pdf") MultipartFile pdf
    ) {
        try {
            emailService.sendPayslipWithAttachment(email, name, payPeriod, pdf.getBytes());
            return ResponseEntity.ok(Map.of("message", "Payslip sent to " + email));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to send email: " + e.getMessage()));
        }
    }
}
