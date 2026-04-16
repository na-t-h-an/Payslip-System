package com.payslip.payroll.service;

import com.payslip.payroll.dto.EmployeeRequestDto;
import com.payslip.payroll.dto.EmployeeResponseDto;
import com.payslip.payroll.entity.Company;
import com.payslip.payroll.entity.Employee;
import com.payslip.payroll.repository.CompanyRepository;
import com.payslip.payroll.repository.EmployeeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final CompanyRepository companyRepository;

    public EmployeeService(EmployeeRepository employeeRepository, CompanyRepository companyRepository) {
        this.employeeRepository = employeeRepository;
        this.companyRepository = companyRepository;
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponseDto> searchEmployees(String query, Long companyId) {
        List<Employee> employees;
        if (companyId != null) {
            employees = (query == null || query.isBlank())
                    ? employeeRepository.findByCompanyId(companyId)
                    : employeeRepository.searchByCompanyId(companyId, query);
        } else {
            employees = (query == null || query.isBlank())
                    ? employeeRepository.findAll()
                    : employeeRepository.findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(query, query);
        }
        return employees.stream()
                .filter(Employee::isActive)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EmployeeResponseDto getEmployee(Long id) {
        return employeeRepository.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
    }

    @Transactional
    public EmployeeResponseDto createEmployee(EmployeeRequestDto dto) {
        Company company = companyRepository.findById(dto.getCompanyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));

        if (employeeRepository.findByEmailAndCompanyId(dto.getEmail(), dto.getCompanyId()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use in this company");
        }

        Employee employee = new Employee();
        employee.setCompany(company);
        employee.setFullName(dto.getFullName());
        employee.setEmail(dto.getEmail());
        employee.setTotalHours(dto.getTotalHours());
        employee.setCurrentRate(dto.getRate());
        employee.setBonus(dto.getBonus() != null ? dto.getBonus() : BigDecimal.ZERO);
        employee.setBankName(dto.getBankName());
        employee.setAccountNumber(dto.getAccountNumber());
        employee.setTransferFee(dto.getTransferFee() != null ? dto.getTransferFee() : BigDecimal.ZERO);
        employee.setCustomData(dto.getCustomData());
        employee.setActive(true);

        return toDto(employeeRepository.save(employee));
    }

    @Transactional
    public Map<String, Integer> bulkImport(Long companyId, List<EmployeeRequestDto> dtos) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));

        int created = 0, updated = 0;
        try {
            for (EmployeeRequestDto dto : dtos) {
                boolean hasEmail = dto.getEmail() != null && !dto.getEmail().isBlank();
                String email = hasEmail ? dto.getEmail().trim().toLowerCase() : "";
                // Match by email when present; fall back to fullName when email is blank
                // so that blank-email rows don't all collapse onto the same "" record.
                var existing = hasEmail
                        ? employeeRepository.findByEmailAndCompanyId(email, companyId)
                        : employeeRepository.findByFullNameAndCompanyId(dto.getFullName().trim(), companyId);
                if (existing.isPresent()) {
                    Employee emp = existing.get();
                    emp.setFullName(dto.getFullName().trim());
                    emp.setTotalHours(dto.getTotalHours());
                    emp.setCurrentRate(dto.getRate());
                    emp.setBonus(dto.getBonus() != null ? dto.getBonus() : BigDecimal.ZERO);
                    emp.setBankName(dto.getBankName());
                    emp.setAccountNumber(dto.getAccountNumber());
                    emp.setTransferFee(dto.getTransferFee() != null ? dto.getTransferFee() : BigDecimal.ZERO);
                    if (dto.getCustomData() != null) emp.setCustomData(dto.getCustomData());
                    employeeRepository.save(emp);
                    updated++;
                } else {
                    Employee emp = new Employee();
                    emp.setCompany(company);
                    emp.setFullName(dto.getFullName().trim());
                    emp.setEmail(email); // "" when no email — stays non-null per DB constraint
                    emp.setTotalHours(dto.getTotalHours());
                    emp.setCurrentRate(dto.getRate());
                    emp.setBonus(dto.getBonus() != null ? dto.getBonus() : BigDecimal.ZERO);
                    emp.setBankName(dto.getBankName());
                    emp.setAccountNumber(dto.getAccountNumber());
                    emp.setTransferFee(dto.getTransferFee() != null ? dto.getTransferFee() : BigDecimal.ZERO);
                    emp.setCustomData(dto.getCustomData());
                    emp.setActive(true);
                    employeeRepository.save(emp);
                    created++;
                }
            }
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "One or more emails already exist in this company. Please check for duplicates and try again.");
        }
        return Map.of("created", created, "updated", updated, "total", created + updated);
    }

    @Transactional
    public void deleteEmployee(Long id) {
        if (!employeeRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found");
        }
        employeeRepository.deleteById(id);
    }

    @Transactional
    public EmployeeResponseDto updateEmployee(Long id, EmployeeRequestDto dto) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        Long companyId = employee.getCompany() != null ? employee.getCompany().getId() : null;
        employeeRepository.findByEmailAndCompanyId(dto.getEmail(), companyId)
                .filter(e -> !e.getId().equals(id))
                .ifPresent(e -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use in this company"); });

        employee.setFullName(dto.getFullName());
        employee.setEmail(dto.getEmail());
        employee.setTotalHours(dto.getTotalHours());
        employee.setCurrentRate(dto.getRate());
        employee.setBonus(dto.getBonus() != null ? dto.getBonus() : BigDecimal.ZERO);
        employee.setBankName(dto.getBankName());
        employee.setAccountNumber(dto.getAccountNumber());
        employee.setTransferFee(dto.getTransferFee() != null ? dto.getTransferFee() : BigDecimal.ZERO);
        if (dto.getCustomData() != null) employee.setCustomData(dto.getCustomData());

        return toDto(employeeRepository.save(employee));
    }

    private EmployeeResponseDto toDto(Employee e) {
        BigDecimal bonus = e.getBonus() != null ? e.getBonus() : BigDecimal.ZERO;
        BigDecimal totalHours = e.getTotalHours() != null ? e.getTotalHours() : BigDecimal.ZERO;
        BigDecimal rate = e.getCurrentRate() != null ? e.getCurrentRate() : BigDecimal.ZERO;
        BigDecimal pay = totalHours.multiply(rate);
        BigDecimal totalPay = pay.add(bonus);

        return EmployeeResponseDto.builder()
                .id(e.getId())
                .companyId(e.getCompany() != null ? e.getCompany().getId() : null)
                .name(e.getFullName())
                .email(e.getEmail())
                .totalHours(totalHours)
                .rate(rate)
                .pay(pay)
                .bonus(bonus)
                .totalPay(totalPay)
                .bankName(e.getBankName())
                .accountNumber(e.getAccountNumber())
                .transferFee(e.getTransferFee() != null ? e.getTransferFee() : BigDecimal.ZERO)
                .customData(e.getCustomData())
                .build();
    }
}