package com.payslip.payroll.controller;

import com.payslip.payroll.entity.Payslip; // Added
import com.payslip.payroll.repository.PayslipRepository; // Added
import com.payslip.payroll.repository.WhitelistRepository;
import com.payslip.payroll.service.EmailService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime; // Added
import java.util.Map;

@RestController
@RequestMapping("/api/payslip")
public class PayslipEmailController {

    private final EmailService emailService;
    private final WhitelistRepository whitelistRepo;
    private final PayslipRepository payslipRepo; // 1. Added Repository

    // 2. Updated Constructor
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
            @RequestParam("payslipId") Long payslipId, // Already here!
            @AuthenticationPrincipal Jwt jwt 
    ) {
        try {
            // 1. Get Accountant Info from Supabase Token
            String accountantEmail = jwt.getClaimAsString("email");
            var metadata = jwt.getClaimAsMap("user_metadata");
            String accountantName = (metadata != null && metadata.containsKey("full_name")) 
                                    ? metadata.get("full_name").toString() 
                                    : accountantEmail;

            // 2. Security Check: Is the accountant whitelisted?
            if (!whitelistRepo.existsById(accountantEmail)) {
                return ResponseEntity.status(403).body(Map.of("error", "Unauthorized access."));
            }

            // 3. Send the actual Email via Gmail
            emailService.sendPayslipWithAttachment(
                employeeEmail, 
                accountantEmail, 
                accountantName,  
                employeeName, 
                payPeriod, 
                pdf.getBytes()
            );

            // 4. THE AUDIT TRAIL: Update the database record
            // This is the part those three accountants will love!
            Payslip payslip = payslipRepo.findById(payslipId)
                .orElseThrow(() -> new RuntimeException("Payslip record not found"));
            
            payslip.setSentAt(LocalDateTime.now());
            payslip.setSentBy(accountantName);
            payslipRepo.save(payslip);

            return ResponseEntity.ok(Map.of("message", "Payslip sent and recorded by " + accountantName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to send: " + e.getMessage()));
        }
    }
}