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
    private final JwtUtils jwtUtils;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public WhitelistSuccessHandler(WhitelistRepository whitelistRepo, JwtUtils jwtUtils) {
        this.whitelistRepo = whitelistRepo;
        this.jwtUtils = jwtUtils;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, 
                                        Authentication authentication) throws IOException {
        
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");

        var entry = whitelistRepo.findById(email);

        if (entry.isPresent()) {
            // 1. Generate the JWT Passport
            String role = entry.get().getRole();
            String token = jwtUtils.generateToken(email, role);

            // 2. Redirect to Vite with the token in the URL
            // Your partner's React code will grab this "token" param and save it
            String targetUrl = frontendUrl + "/login-success?token=" + token;
            getRedirectStrategy().sendRedirect(request, response, targetUrl);
        } else {
            getRedirectStrategy().sendRedirect(request, response, frontendUrl + "/access-denied");
        }
    }
}