package com.payslip.payroll.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payslips")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Payslip {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "employee_id")
    private Employee employee;

    @ManyToOne
    @JoinColumn(name = "pay_period_id")
    private PayPeriod payPeriod;

    @Column(precision = 19, scale = 4)
    private BigDecimal totalHours;

    @Column(precision = 19, scale = 4)
    private BigDecimal rateAtTime; // Snapshot of rate when payslip was made

    @Column(precision = 19, scale = 4)
    private BigDecimal bonus;

    @Column(precision = 19, scale = 4)
    private BigDecimal totalPhpPay; // Calculated result: (Hours * Rate + Bonus) * ExRate

    private LocalDateTime sentAt;

    private String sentBy;
}