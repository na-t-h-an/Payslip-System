package com.payslip.payroll.dto;

import lombok.*;
import java.math.BigDecimal;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmployeeResponseDto {
    private Long id;
    private Long companyId;
    private String name;
    private String email;
    private BigDecimal totalHours;
    private BigDecimal rate;
    private BigDecimal pay;
    private BigDecimal bonus;
    private BigDecimal totalPay;
    private String bankName;
    private String accountNumber;
    private BigDecimal transferFee;
}
