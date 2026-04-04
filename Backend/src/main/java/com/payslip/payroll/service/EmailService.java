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
        helper.setSubject("Your Payslip for " + payPeriod);

        helper.setText(
                "================================================\n" +
                        "  DMA Global Accounting Services, Co. (the Firm) acts as a third-party\n" +
                        "  payroll disbursement officer. The Firm is responsible solely for the\n" +
                        "  release of funds and pay slips according to the schedule set by your\n" +
                        "  employer (the Client).\n" +
                        "================================================\n\n" +
                        "Dear " + employeeName + ",\n\n" +
                        "Please find attached your payslip for the period of " + payPeriod + ".\n\n" +
                        "This is a system-generated and password-protected document for security purposes.\n\n" +
                        "Password format: First 2 letters of your first name & last name (all caps) +\n" +
                        "last 4 digits of your account / mobile number (xxxxxxxx1234).\n\n" +
                        "Disputes: Contact the Client's representatives (Fredo / Anna Ramos Marcos)\n" +
                        "directly for concerns regarding work hours, rates, bonuses, or unapproved time.\n" +
                        "The Firm is not liable for missing hours, unapproved time, or variances in\n" +
                        "hourly rates and bonuses.\n\n" +
                        "Approved Hours/Rate: Logged hours, hourly pay, and bonuses are determined\n" +
                        "solely by the Client.\n\n" +
                        "Schedule: Payments and pay slips are released during the Friday shift (PST),\n" +
                        "spanning Friday to Saturday (PH Time). Any releases made earlier or later\n" +
                        "than this are exceptions, usually due to local or international bank holidays.\n\n" +
                        "DMA Global Accounting Services, Co.\n\n" +
                        "================================================\n" +
                        "  This is a system-generated email.\n" +
                        "  This document serves as your official payroll copy.\n" +
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