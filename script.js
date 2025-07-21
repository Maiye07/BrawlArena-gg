document.addEventListener('DOMContentLoaded', () => {
    const welcomeSection = document.getElementById('welcome-section');
    const authContainer = document.getElementById('auth-container');
    const registerSection = document.getElementById('register-section');
    const loginSection = document.getElementById('login-section');
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const showLoginLink = document.getElementById('show-login');
    const showRegisterLink = document.getElementById('show-register');
    const showAuthButton = document.getElementById('show-auth-button');
    const messageDisplay = document.getElementById('message');

    const API_URL = 'https://brawlarena-gg.onrender.com';

    function showMessage(msg, type) {
        messageDisplay.textContent = msg;
        messageDisplay.className = type;
    }

    showAuthButton.addEventListener('click', (e) => {
        e.preventDefault();
        welcomeSection.style.display = 'none';
        authContainer.style.display = 'block';
        loginSection.style.display = 'block';
        registerSection.style.display = 'none';
        messageDisplay.textContent = '';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
        messageDisplay.textContent = '';
    });

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
        messageDisplay.textContent = '';
    });
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;

        // AJOUT : Validation du format du nom d'utilisateur côté client
        const validUsernameRegex = /^[A-Za-z0-9]+$/;
        if (!validUsernameRegex.test(username)) {
            showMessage('Pseudo invalide.', 'error');
            return; // On arrête l'exécution
        }

        showMessage('Création du compte en cours...', 'success');
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                showMessage(data.error || 'Une erreur est survenue.', 'error');
            } else {
                showMessage(data.message, 'success');
                registerForm.reset();
            }
        } catch (error) {
            showMessage('Erreur de communication avec le serveur.', 'error');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        showMessage('Vérification en cours...', 'success');
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                showMessage(data.error, 'error');
                return;
            }

            localStorage.setItem('loggedInUsername', data.username);
            localStorage.setItem('isPremium', data.isPremium);
            
            const userStats = {
                dailyScrims: data.dailyScrims,
                lastActivityDate: data.lastActivityDate
            };
            localStorage.setItem('userDailyStats', JSON.stringify(userStats));

            window.location.href = 'dashboard.html';
        } catch (error) {
            showMessage('Erreur de communication avec le serveur.', 'error');
        }
    });
});