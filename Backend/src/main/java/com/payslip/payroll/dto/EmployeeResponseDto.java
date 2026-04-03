package com.payslip.payroll.dto;

import lombok.*;
import java.math.BigDecimal;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmployeeResponseDto {
    private Long id;
    private String name;         // maps from fullName
    private String email;
    private BigDecimal totalHours;
    private BigDecimal rate;
    private BigDecimal pay;      // computed: totalHours × rate
    private BigDecimal bonus;
    private BigDecimal totalPay; // computed: pay + bonus
}
