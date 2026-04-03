package com.payslip.payroll;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class PayrollBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PayrollBackendApplication.class, args);
		System.out.println("==============================");
		System.out.println("|BACKEND STARTED SUCCESSFULLY|");
		System.out.println("==============================");
	}
}
