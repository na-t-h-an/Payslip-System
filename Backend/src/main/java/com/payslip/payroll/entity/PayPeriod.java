package com.payslip.payroll.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "pay_periods")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PayPeriod {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate startDate;
    private LocalDate endDate;

    @Column(precision = 19, scale = 4)
    private BigDecimal exchangeRate;

    @Column(precision = 19, scale = 4)
    private BigDecimal transferFee;

    @ManyToOne
    @JoinColumn(name = "company_id")
    private Company company;
}
