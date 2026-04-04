package com.payslip.payroll.controller;

import com.payslip.payroll.entity.Company;
import com.payslip.payroll.repository.CompanyRepository;
import com.payslip.payroll.repository.WhitelistRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {

    private final CompanyRepository companyRepo;
    private final WhitelistRepository whitelistRepo;

    public CompanyController(CompanyRepository companyRepo, WhitelistRepository whitelistRepo) {
        this.companyRepo = companyRepo;
        this.whitelistRepo = whitelistRepo;
    }

    // GET /api/companies
    @GetMapping
    public ResponseEntity<List<Company>> getAllCompanies(@AuthenticationPrincipal Jwt jwt) {
        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(companyRepo.findAll());
    }

    // POST /api/companies
    @PostMapping
    public ResponseEntity<?> createCompany(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        if (!whitelistRepo.existsById(jwt.getClaimAsString("email"))) {
            return ResponseEntity.status(403).build();
        }
        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Company name is required"));
        }
        Company company = new Company();
        company.setName(name.trim());
        return ResponseEntity.ok(companyRepo.save(company));
    }
}
