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
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
    });

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
    });
    
    // --- Logique d'inscription (communique avec le serveur) ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const playerTag = document.getElementById('register-player-tag').value;

        if (!playerTag.startsWith('#')) {
            showMessage('Le tag du joueur doit commencer par #.', 'error');
            return;
        }

        showMessage('Vérification du tag Brawl Stars...', 'success');
        try {
            // On vérifie le tag auprès du serveur
            const response = await fetch('https://brawlarena-gg.onrender.com/verify-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerTag }),
            });
            const data = await response.json();
            if (!response.ok) {
                showMessage(`Erreur : ${data.error || 'Tag joueur non valide.'}`, 'error');
                return;
            }
            
            // Si le tag est bon, on sauvegarde en local
            let users = JSON.parse(localStorage.getItem('users')) || [];
            if (users.find(user => user.username === username)) {
                showMessage("Ce nom d'utilisateur est déjà pris.", 'error');
                return;
            }
            users.push({
                username,
                password,
                playerTag: data.tag,
                inGameName: data.name
            });
            localStorage.setItem('users', JSON.stringify(users));
            showMessage(`Compte créé pour ${data.name} ! Vous pouvez vous connecter.`, 'success');
            
        } catch (error) {
            showMessage('Erreur de communication avec le serveur.', 'error');
        }
    });

    // --- Logique de connexion (communique avec le serveur) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const playerTag = document.getElementById('login-player-tag').value;

        if (!playerTag.startsWith('#')) {
            showMessage('Le tag du joueur doit commencer par #.', 'error');
            return;
        }
        
        showMessage('Vérification en cours...', 'success');
        try {
            // On appelle le serveur pour la connexion
            const response = await fetch('https://brawlarena-gg.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerTag }),
            });
            const data = await response.json();
            if (!response.ok) {
                showMessage(data.error, 'error');
                return;
            }

            // Si le serveur confirme, on connecte l'utilisateur
            localStorage.setItem('loggedInUsername', data.player.name);
            window.location.href = 'dashboard.html';

        } catch (error) {
            showMessage('Erreur de communication avec le serveur.', 'error');
        }
    });
});