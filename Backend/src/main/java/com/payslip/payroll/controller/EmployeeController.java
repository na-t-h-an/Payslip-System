package com.payslip.payroll.controller;

import com.payslip.payroll.dto.EmployeeRequestDto;
import com.payslip.payroll.dto.EmployeeResponseDto;
import com.payslip.payroll.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    // GET /api/employees?search=anna&companyId=1
    @GetMapping
    public ResponseEntity<List<EmployeeResponseDto>> searchEmployees(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long companyId) {
        return ResponseEntity.ok(employeeService.searchEmployees(search, companyId));
    }

    // GET /api/employees/{id}
    @GetMapping("/{id}")
    public ResponseEntity<EmployeeResponseDto> getEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.getEmployee(id));
    }

    // POST /api/employees
    @PostMapping
    public ResponseEntity<EmployeeResponseDto> createEmployee(
            @Valid @RequestBody EmployeeRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(employeeService.createEmployee(dto));
    }

    // POST /api/employees/bulk?companyId=1
    @PostMapping("/bulk")
    public ResponseEntity<?> bulkImport(
            @RequestParam Long companyId,
            @RequestBody List<EmployeeRequestDto> employees) {
        return ResponseEntity.ok(employeeService.bulkImport(companyId, employees));
    }

    // PUT /api/employees/{id}
    @PutMapping("/{id}")
    public ResponseEntity<EmployeeResponseDto> updateEmployee(
            @PathVariable Long id,
            @Valid @RequestBody EmployeeRequestDto dto) {
        return ResponseEntity.ok(employeeService.updateEmployee(id, dto));
    }
}
