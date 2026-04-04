package com.payslip.payroll.controller;

import com.payslip.payroll.repository.EmployeeRepository;
import com.payslip.payroll.repository.PayslipRepository;
import com.payslip.payroll.repository.WhitelistRepository;
import com.payslip.payroll.service.EmailService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/payslip")
public class PayslipEmailController {

    private final EmailService emailService;
    private final WhitelistRepository whitelistRepo;
    private final PayslipRepository payslipRepo;
    private final EmployeeRepository employeeRepo;

    public PayslipEmailController(EmailService emailService,
                                  WhitelistRepository whitelistRepo,
                                  PayslipRepository payslipRepo,
                                  EmployeeRepository employeeRepo) {
        this.emailService = emailService;
        this.whitelistRepo = whitelistRepo;
        this.payslipRepo = payslipRepo;
        this.employeeRepo = employeeRepo;
    }

    private static final Set<String> NAME_SUFFIXES = Set.of(
            "jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v", "vi", "2nd", "3rd", "4th"
    );

    /**
     * Password format: first 2 chars of first name + first 2 chars of last name (all caps)
     * + last 4 digits of account number (non-alphanumeric stripped).
     *
     * Handles middle names and common suffixes (Jr, Sr, III, IV, etc.).
     * Examples:
     *   "Nathan Xander Lada"   → NA + LA + last4
     *   "Robert Amaba Jr."     → RO + AM + last4  (Jr. skipped)
     *   "Maria Santos III"     → MA + SA + last4  (III skipped)
     */
    private String computePassword(String fullName, String accountNumber) {
        String[] parts = fullName.trim().split("\\s+");

        // Strip known suffixes from the tail, but keep at least 1 word
        int end = parts.length;
        while (end > 1 && NAME_SUFFIXES.contains(parts[end - 1].toLowerCase())) {
            end--;
        }

        String firstName = parts[0];
        String lastName = parts[end - 1]; // last non-suffix word

        String first2 = firstName.length() >= 2
                ? firstName.substring(0, 2).toUpperCase()
                : firstName.toUpperCase();
        String last2 = lastName.length() >= 2
                ? lastName.substring(0, 2).toUpperCase()
                : lastName.toUpperCase();

        String clean = accountNumber.replaceAll("[^0-9a-zA-Z]", "");
        String last4 = clean.length() >= 4
                ? clean.substring(clean.length() - 4)
                : clean;

        return first2 + last2 + last4;
    }

    private byte[] encryptPdf(byte[] pdfBytes, String userPassword) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            AccessPermission ap = new AccessPermission();
            ap.setCanPrint(true);
            ap.setCanExtractContent(false);
            ap.setCanModify(false);

            StandardProtectionPolicy spp = new StandardProtectionPolicy(
                    "DMAOwner2024!", userPassword, ap);
            spp.setEncryptionKeyLength(128);
            doc.protect(spp);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
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

            byte[] pdfBytes = pdf.getBytes();

            // Encrypt PDF if employee has an account number
            if (employeeId != null) {
                var empOpt = employeeRepo.findById(employeeId);
                if (empOpt.isPresent()) {
                    String accountNumber = empOpt.get().getAccountNumber();
                    String fullName = empOpt.get().getFullName();
                    if (accountNumber != null && !accountNumber.isBlank()) {
                        String password = computePassword(fullName, accountNumber);
                        pdfBytes = encryptPdf(pdfBytes, password);
                    }
                }
            }

            emailService.sendPayslipWithAttachment(
                employeeEmail,
                accountantEmail,
                accountantName,
                employeeName,
                payPeriod,
                pdfBytes
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