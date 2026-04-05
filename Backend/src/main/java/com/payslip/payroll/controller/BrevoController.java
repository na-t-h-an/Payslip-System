package com.payslip.payroll.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/brevo")
public class BrevoController {

    @Value("${brevo.api.key:${spring.mail.password:}}")
    private String brevoApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String BREVO_BASE = "https://api.brevo.com/v3";

    @GetMapping("/quota")
    public ResponseEntity<?> getEmailQuota() {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("api-key", brevoApiKey);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            // 1. Get account plan info
            ResponseEntity<Map<String, Object>> accountRes = restTemplate.exchange(
                BREVO_BASE + "/account", HttpMethod.GET, entity,
                new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {}
            );

            Map<String, Object> account = accountRes.getBody();
            List<?> plans = account != null ? (List<?>) account.get("plan") : null;

            // limit = total plan quota (fixed), remaining = credits field (Brevo returns current remaining)
            int limit = 300;
            int remaining = 300;
            String resetDate = LocalDate.now().plusMonths(1).withDayOfMonth(1).toString();

            if (plans != null) {
                for (Object planObj : plans) {
                    Map<?, ?> plan = (Map<?, ?>) planObj;
                    if ("sendLimit".equals(plan.get("creditsType"))) {
                        // credits = remaining per Brevo API docs, not the total
                        if (plan.get("credits") != null)
                            remaining = ((Number) plan.get("credits")).intValue();
                        if (plan.get("endDate") != null)
                            resetDate = plan.get("endDate").toString();
                        // For free plan the cap is always 300; paid plans may differ
                        limit = Math.max(limit, remaining);
                        break;
                    }
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("limit", limit);
            result.put("sent", limit - remaining);
            result.put("remaining", remaining);
            result.put("resetDate", resetDate);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // Return graceful fallback so the UI doesn't break
            return ResponseEntity.ok(Map.of(
                "limit", 0, "sent", 0, "remaining", 0, "resetDate", "", "error", e.getMessage()
            ));
        }
    }
}
