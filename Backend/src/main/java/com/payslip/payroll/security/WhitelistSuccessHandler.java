package com.payslip.payroll.security;

import com.payslip.payroll.repository.WhitelistRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class WhitelistSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final WhitelistRepository whitelistRepo;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    public WhitelistSuccessHandler(WhitelistRepository whitelistRepo) {
        this.whitelistRepo = whitelistRepo;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, 
                                        Authentication authentication) throws IOException {
        
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");

        // Check if the user is in our Supabase whitelist table
        var entry = whitelistRepo.findById(email);

        if (entry.isPresent()) {
            // SUCCESS: Redirect to React dashboard (We'll add JWT here later!)
            getRedirectStrategy().sendRedirect(request, response, frontendUrl + "/dashboard");
        } else {
            // FAILURE: Not on the list. Send them to an error page.
            getRedirectStrategy().sendRedirect(request, response, frontendUrl + "/access-denied");
        }
    }
}