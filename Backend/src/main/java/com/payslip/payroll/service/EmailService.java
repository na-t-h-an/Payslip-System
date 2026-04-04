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

    @Value("${spring.mail.username}")
    private String officeEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    // 1. For simple text emails (from the first button we made)
    public void sendPayslipEmail(String toEmail, String replyToEmail, String senderName, String body) {
        SimpleMailMessage message = new SimpleMailMessage();

        message.setFrom("DMA Payroll Office <" + officeEmail + ">");
        message.setReplyTo(replyToEmail);
        message.setTo(toEmail);
        message.setSubject("Your Payslip - Processed by " + senderName);
        message.setText(body);

        mailSender.send(message);
    }

    // 2. For PDF attachments (Updated with 6 parameters)
    public void sendPayslipWithAttachment(
            String toEmail,
            String replyToEmail,
            String senderName,
            String employeeName,
            String payPeriod,
            byte[] pdfBytes) throws MessagingException {

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true);

        helper.setFrom("DMA Payroll Office <" + officeEmail + ">");
        helper.setReplyTo(replyToEmail);
        helper.setTo(toEmail);
        helper.setSubject("[TEST] Your Payslip for " + payPeriod + " — Processed by " + senderName);

        helper.setText(
                "================================================\n" +
                        "  ⚠️  THIS IS A TEST EMAIL — DO NOT ACT ON THIS  \n" +
                        "  This message was sent for testing purposes only.\n" +
                        "  No real payroll data has been processed.\n" +
                        "================================================\n\n" +
                        "Dear " + employeeName + ",\n\n" +
                        "Please find your payslip attached for the pay period: " + payPeriod + ".\n\n" +
                        "This was processed by " + senderName + ". If you have any questions, " +
                        "please reply directly to this email.\n\n" +
                        "Best regards,\n" +
                        senderName + "\n" +
                        "DMA Global Accounting Services, Co.\n\n" +
                        "================================================\n" +
                        "  ⚠️  TEST EMAIL — PLEASE DISREGARD             \n" +
                        "================================================",
                false);

        String fileName = "Payslip_" + employeeName.replace(" ", "_") + ".pdf";

        helper.addAttachment(
                fileName,
                new ByteArrayResource(pdfBytes),
                "application/pdf");

        mailSender.send(message);
    }
}