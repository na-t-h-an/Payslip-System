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

    @Value("${app.mail.from}")
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
            "Dear " + employeeName + ",\n\n" +
            "Please find attached your payslip for the pay period of " + payPeriod + ".\n\n" +
            "The attached document is password-protected.\n\n" +
            "------------------------------------------------------------------\n" +
            "  HOW TO OPEN YOUR PAYSLIP (PASSWORD)\n" +
            "------------------------------------------------------------------\n" +
            "The attached file is password-protected. To open it, combine:\n\n" +
            "1. FIRST 2 letters of your First Name (IN CAPITAL LETTERS)\n" +
            "2. FIRST 2 letters of your Last Name (IN CAPITAL LETTERS)\n" +
            "3. LAST 4 digits of your Bank Account or Mobile Number\n\n" +
            "EXAMPLE:\n" +
            "Name: JOHN DOE | Number ends in: 1234\n" +
            "Your Password: JODO1234\n\n" +
            "APPROVED HOURS & RATE\n" +
            "All logged hours, pay rates, and bonuses are determined exclusively by your employer (the Client).\n\n" +
            "REGARDING DISPUTES\n" +
            "For concerns related to work hours, rates, bonuses, or unapproved time, please coordinate\n" +
            "directly with your employer's representatives.\n\n" +
            "PAYMENT SCHEDULE\n" +
            "Payslips and payments are released during the Friday shift (PST), corresponding to Friday–Saturday\n" +
            "in Philippine Time. Releases outside this window are exceptions, typically due to local or\n" +
            "international bank holidays.\n\n" +
            "\n\nDMA Global Accounting Services, Co. (the Firm) acts solely as a third-party payroll disbursement officer\n" +
            "and is not liable for variances in logged hours, hourly rates, or bonuses.\n\n" +
            "DMA Global Accounting Services, Co.\n\n" +
            "The attached document serves as your official payroll record.\n" +
            "This message and its attachments are intended solely for the named recipient." + 
            "\n\n\n" +
            "=========================================================" + 
            " THIS IS A SYSTEM GENERATED EMAIL. PLEASE DO NOT REPLY." + 
            "=========================================================",
            false);

        String fileName = "Payslip_" + employeeName.replace(" ", "_") + ".pdf";

        helper.addAttachment(
                fileName,
                new ByteArrayResource(pdfBytes),
                "application/pdf");

        mailSender.send(message);
    }
}