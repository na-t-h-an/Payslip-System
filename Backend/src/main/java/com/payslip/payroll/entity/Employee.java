package com.payslip.payroll.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "employees")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Employee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String email;

    @Column(precision = 10, scale = 2)
    private BigDecimal totalHours;

    @Column(precision = 19, scale = 4)
    private BigDecimal currentRate;

    @Column(precision = 10, scale = 2)
    private BigDecimal bonus;

    private String bankName;

    private String accountNumber;

    @Column(precision = 19, scale = 4)
    private BigDecimal transferFee;

    private boolean isActive = true;

    @ManyToOne
    @JoinColumn(name = "company_id")
    private Company company;

    @JsonIgnore
    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Payslip> payslips;
}