/**
 * klog-ai Landing Page
 * 
 * Email capture form with API integration.
 * Falls back to mailto: if API fails.
 */

(function() {
    'use strict';

    const FALLBACK_EMAIL = 'access@atlas-di.app';
    const STORAGE_KEY = 'klog_lead_email';

    const form = document.getElementById('access-form');
    const emailInput = document.getElementById('email-input');
    const formSuccess = document.getElementById('form-success');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (!form || !emailInput || !formSuccess) {
        return;
    }

    // Check if already submitted
    const storedEmail = localStorage.getItem(STORAGE_KEY);
    if (storedEmail) {
        showSuccess();
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = emailInput.value.trim();

        // Basic email validation
        if (!isValidEmail(email)) {
            emailInput.focus();
            showError('Please enter a valid email address');
            return;
        }

        // Disable form while submitting
        setLoading(true);

        try {
            const response = await fetch('/api/lead', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    source: 'landing',
                    ts: Date.now(),
                    ua: navigator.userAgent,
                }),
            });

            const data = await response.json();

            if (response.ok && data.ok) {
                // Success - store email and show success state
                localStorage.setItem(STORAGE_KEY, email);
                showSuccess();
            } else if (response.status === 429) {
                // Rate limited
                showError('Too many requests. Please try again later.');
                setLoading(false);
            } else if (response.status === 400) {
                // Validation error
                showError(data.error || 'Invalid email format');
                setLoading(false);
            } else {
                // Server error - fallback to mailto
                fallbackToMailto(email);
            }
        } catch (err) {
            // Network error - fallback to mailto
            console.error('[klog] API error:', err.message);
            fallbackToMailto(email);
        }
    });

    function isValidEmail(email) {
        if (!email || email.length > 254) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function setLoading(loading) {
        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.textContent = loading ? 'Submitting...' : 'Request access';
        }
        emailInput.disabled = loading;
    }

    function showError(message) {
        emailInput.style.borderColor = '#f87171';
        
        // Show error message if container exists
        let errorEl = form.querySelector('.form-error');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.className = 'form-error';
            errorEl.style.cssText = 'color: #f87171; font-size: 0.75rem; margin-top: 0.5rem; font-family: var(--font-mono);';
            form.appendChild(errorEl);
        }
        errorEl.textContent = message;
        
        setTimeout(() => {
            emailInput.style.borderColor = '';
            if (errorEl) errorEl.remove();
        }, 4000);
    }

    function showSuccess() {
        form.style.display = 'none';
        formSuccess.classList.remove('hidden');
    }

    function fallbackToMailto(email) {
        // Show fallback message
        const container = form.parentElement;
        form.style.display = 'none';
        
        const fallbackEl = document.createElement('div');
        fallbackEl.className = 'form-fallback';
        fallbackEl.innerHTML = `
            <p style="color: var(--text-secondary); font-size: 0.9375rem; margin-bottom: 1rem;">
                We couldn't process your request automatically.
            </p>
            <p style="color: var(--text-secondary); font-size: 0.9375rem; margin-bottom: 1rem;">
                Please email us directly:
            </p>
            <a href="mailto:${FALLBACK_EMAIL}?subject=klog-ai%20Early%20Access&body=Email:%20${encodeURIComponent(email)}" 
               class="btn btn-primary"
               style="display: inline-block; text-decoration: none;">
                Email ${FALLBACK_EMAIL}
            </a>
        `;
        container.appendChild(fallbackEl);
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
})();
