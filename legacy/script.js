document.addEventListener('DOMContentLoaded', () => {
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const loginForm = document.getElementById('loginForm');

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Toggle icon
        const icon = togglePasswordBtn.querySelector('i');
        if (type === 'text') {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });

    // Handle form submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = passwordInput.value;
        const submitBtn = loginForm.querySelector('.submit-btn');
        
        // Add loading state to button
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Iniciando sesión...</span>';
        submitBtn.style.opacity = '0.8';
        submitBtn.style.pointerEvents = 'none';

        // Test user credentials
        const testUser = {
            email: 'prueba@ejemplo.com',
            password: '12345'
        };

        // Simulate API call
        setTimeout(() => {
            if (email === testUser.email && password === testUser.password) {
                // Success: Redirect to dashboard
                submitBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>¡Ingreso exitoso!</span>';
                submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                // Error: Show error message
                submitBtn.innerHTML = '<i class="fa-solid fa-xmark"></i><span>Credenciales incorrectas</span>';
                submitBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                
                setTimeout(() => {
                    submitBtn.innerHTML = originalText;
                    submitBtn.style.background = '';
                    submitBtn.style.opacity = '1';
                    submitBtn.style.pointerEvents = 'all';
                }, 2000);
            }
        }, 1500);
    });

    // Add subtle interactive effect to background shapes based on mouse movement
    document.addEventListener('mousemove', (e) => {
        const shapes = document.querySelectorAll('.shape');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        shapes.forEach((shape, index) => {
            const speed = (index + 1) * 20;
            const moveX = (x - 0.5) * speed;
            const moveY = (y - 0.5) * speed;
            
            // Apply a slight transform in addition to the animation
            shape.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    });
});
