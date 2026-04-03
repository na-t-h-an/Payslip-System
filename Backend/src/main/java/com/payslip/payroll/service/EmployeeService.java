package com.payslip.payroll.service;

import com.payslip.payroll.dto.EmployeeRequestDto;
import com.payslip.payroll.dto.EmployeeResponseDto;
import com.payslip.payroll.entity.Employee;
import com.payslip.payroll.repository.EmployeeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    public EmployeeService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponseDto> searchEmployees(String query) {
        List<Employee> employees = (query == null || query.isBlank())
                ? employeeRepository.findAll()
                : employeeRepository.findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(query, query);

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

    public EmployeeResponseDto createEmployee(EmployeeRequestDto dto) {
        if (employeeRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use");
        }

        Employee employee = new Employee();
        employee.setFullName(dto.getFullName());
        employee.setEmail(dto.getEmail());
        employee.setTotalHours(dto.getTotalHours());
        employee.setCurrentRate(dto.getRate());
        employee.setBonus(dto.getBonus() != null ? dto.getBonus() : BigDecimal.ZERO);
        employee.setActive(true);

        return toDto(employeeRepository.save(employee));
    }

    public EmployeeResponseDto updateEmployee(Long id, EmployeeRequestDto dto) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        // Check if new email conflicts with a different employee
        employeeRepository.findByEmail(dto.getEmail())
                .filter(e -> !e.getId().equals(id))
                .ifPresent(e -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use"); });

        employee.setFullName(dto.getFullName());
        employee.setEmail(dto.getEmail());
        employee.setTotalHours(dto.getTotalHours());
        employee.setCurrentRate(dto.getRate());
        employee.setBonus(dto.getBonus() != null ? dto.getBonus() : BigDecimal.ZERO);

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
                .name(e.getFullName())
                .email(e.getEmail())
                .totalHours(totalHours)
                .rate(rate)
                .pay(pay)
                .bonus(bonus)
                .totalPay(totalPay)
                .build();
    }
}
