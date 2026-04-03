package com.payslip.payroll.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "whitelist")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Whitelist {
    @Id
    private String email; // Primary Key is the Gmail address
    private String role;  // "ADMIN" or "EMPLOYEE"
}