package com.payslip.payroll.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "employees")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Employee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(precision = 10, scale = 2)
    private BigDecimal totalHours;

    @Column(precision = 19, scale = 4)
    private BigDecimal currentRate; // Default hourly rate (e.g., 9.00)

    @Column(precision = 10, scale = 2)
    private BigDecimal bonus; // Optional, defaults to 0

    private boolean isActive = true;
}