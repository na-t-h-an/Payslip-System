package com.payslip.payroll.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    // This grabs the email you set in spring.mail.username automatically
    @Value("${spring.mail.username}")
    private String officeEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendPayslipEmail(String toEmail, String replyToEmail, String senderName, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        
        // Use the variable instead of hardcoding it!
        // The format "Name <email>" makes it look professional in their inbox.
        message.setFrom("DMA Payroll Office <" + officeEmail + ">"); 
        
        message.setReplyTo(replyToEmail); 
        message.setTo(toEmail);
        message.setSubject("Your Payslip - Processed by " + senderName);
        message.setText(body);

        mailSender.send(message);
    }

    public void sendPayslipWithAttachment(String toEmail, String employeeName, String payPeriod, byte[] pdfBytes)
            throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true);

        helper.setFrom("DMA Payroll Office <" + officeEmail + ">");
        helper.setTo(toEmail);
        helper.setSubject("Your Payslip — " + payPeriod);
        helper.setText(
            "Dear " + employeeName + ",\n\n" +
            "Please find your payslip attached for the pay period: " + payPeriod + ".\n\n" +
            "If you have any questions or concerns, please do not reply to this email.\n\n" +
            "Best regards,\n" +
            "DMA Global Accounting Services, Co.",
            false
        );

        helper.addAttachment(
            "Payslip - " + employeeName + ".pdf",
            new ByteArrayResource(pdfBytes),
            "application/pdf"
        );

        mailSender.send(message);
    }
}