package com.payslip.payroll.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendPayslipEmail(String toEmail, String replyToEmail, String senderName, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        
        // The "Office" email (the one with the App Password)
        message.setFrom("DMA Payroll Office <your-central-office@gmail.com>"); 
        
        // If the employee replies, it goes to the specific accountant
        message.setReplyTo(replyToEmail); 
        
        message.setTo(toEmail);
        message.setSubject("Your Payslip - Processed by " + senderName);
        message.setText(body);

        mailSender.send(message);
    }
}