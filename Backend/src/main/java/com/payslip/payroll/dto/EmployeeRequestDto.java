package com.payslip.payroll.dto;

import jakarta.validation.constraints.*;
import lombok.*;
import java.math.BigDecimal;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class EmployeeRequestDto {

    @NotNull(message = "Company ID is required")
    private Long companyId;

    @NotBlank(message = "Full name is required")
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotNull(message = "Total hours is required")
    @DecimalMin(value = "0.00", message = "Total hours cannot be negative")
    private BigDecimal totalHours;

    @NotNull(message = "Rate is required")
    @DecimalMin(value = "0.00", inclusive = false, message = "Rate must be greater than 0")
    private BigDecimal rate;

    @DecimalMin(value = "0.00", message = "Bonus cannot be negative")
    private BigDecimal bonus;

    private String bankName;

    private String accountNumber;

    @DecimalMin(value = "0.00", message = "Transfer fee cannot be negative")
    private BigDecimal transferFee;
}
