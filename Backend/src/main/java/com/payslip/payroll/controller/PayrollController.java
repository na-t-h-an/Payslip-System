package com.payslip.payroll.controller;

import com.payslip.payroll.entity.Payslip;
import com.payslip.payroll.repository.PayslipRepository;
import com.payslip.payroll.service.EmailService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {

    private final EmailService emailService;
    private final PayslipRepository payslipRepo;

    public PayrollController(EmailService emailService, PayslipRepository payslipRepo) {
        this.emailService = emailService;
        this.payslipRepo = payslipRepo;
    }

    @PostMapping("/send-payslip/{id}")
    public String sendPayslip(@PathVariable Long id) {
        // 1. Get the currently logged-in Accountant from Google OAuth
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof OAuth2User)) {
            throw new RuntimeException("User not authenticated via Google");
        }
        
        OAuth2User user = (OAuth2User) auth.getPrincipal();
        String accountantEmail = user.getAttribute("email");
        String accountantName = user.getAttribute("name"); // e.g., "Nathan Smith"

        // 2. Find the Payslip
        Payslip payslip = payslipRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Payslip not found"));

        // 3. Create the personal email body
        String emailBody = String.format(
            "Hi %s,\n\nYour payroll for the period %s to %s has been processed by %s.\n\n" +
            "Total PHP Pay: %.2f\n\n" +
            "If you have any questions, please reply directly to this email to reach me.\n\n" +
            "Regards,\n%s\nDMA Payroll Team",
            payslip.getEmployee().getFullName(),
            payslip.getPayPeriod().getStartDate(),
            payslip.getPayPeriod().getEndDate(),
            accountantName,
            payslip.getTotalPhpPay(),
            accountantName
        );

        // 4. Send the Email with the "Reply-To" set to the specific accountant
        emailService.sendPayslipEmail(
            payslip.getEmployee().getEmail(), 
            accountantEmail, 
            accountantName, 
            emailBody
        );

        // 5. Update the audit trail so other accountants can see who did it
        payslip.setSentAt(LocalDateTime.now());
        payslip.setSentBy(accountantName); 
        payslipRepo.save(payslip);

        return "Successfully sent to " + payslip.getEmployee().getEmail() + " by " + accountantName;
    }
}