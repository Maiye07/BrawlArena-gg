document.addEventListener('DOMContentLoaded', () => {
    // Sélection des éléments
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

    // URL du serveur backend
    const API_URL = 'https://brawlarena-gg.onrender.com'; // Ou 'http://localhost:3000' en local

    function showMessage(msg, type) {
        messageDisplay.textContent = msg;
        messageDisplay.className = type;
    }

    // --- Logique pour afficher/cacher les formulaires ---
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
    
    // --- Logique d'inscription ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;

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

    // --- Logique de connexion ---
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

            // Si le serveur confirme, on connecte l'utilisateur
            localStorage.setItem('loggedInUsername', data.username);
            window.location.href = 'dashboard.html';

        } catch (error) {
            showMessage('Erreur de communication avec le serveur.', 'error');
        }
    });
});