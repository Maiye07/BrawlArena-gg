document.addEventListener('DOMContentLoaded', () => {
    // Select HTML elements
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

    // ... (les fonctions pour changer de vue ne changent pas)

    showAuthButton.addEventListener('click', (e) => {
        e.preventDefault();
        welcomeSection.style.display = 'none';
        authContainer.style.display = 'block';
        loginSection.style.display = 'block';
        registerSection.style.display = 'none';
        messageDisplay.textContent = '';
        registerForm.reset();
        loginForm.reset();
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
        messageDisplay.textContent = '';
        registerForm.reset();
        loginForm.reset();
    });

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
        messageDisplay.textContent = '';
        registerForm.reset();
        loginForm.reset();
    });
    
    // La logique d'inscription ne change pas
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = registerForm['register-username'].value;
        const password = registerForm['register-password'].value;
        const playerTag = registerForm['register-player-tag'].value;

        if (!playerTag.startsWith('#')) {
            showMessage('Le tag du joueur doit commencer par #.', 'error');
            return;
        }

        let users = JSON.parse(localStorage.getItem('users')) || [];
        if (users.find(user => user.username === username)) {
            showMessage("Ce nom d'utilisateur existe déjà !", 'error');
            return;
        }

        try {
            const response = await fetch('https://brawlarena-gg.onrender.com/verify-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerTag: playerTag }),
            });
            const data = await response.json();
            if (!response.ok) {
                showMessage(`Erreur : ${data.error || 'Tag joueur non valide.'}`, 'error');
                return;
            }
            users.push({
                username: username,
                password: password,
                playerTag: data.tag,
                inGameName: data.name
            });
            localStorage.setItem('users', JSON.stringify(users));
            showMessage(`Compte créé pour ${data.name} ! Vous pouvez vous connecter.`, 'success');
            setTimeout(() => {
                registerSection.style.display = 'none';
                loginSection.style.display = 'block';
                messageDisplay.textContent = '';
                registerForm.reset();
            }, 2000);
        } catch (error) {
            showMessage('Erreur de communication avec le serveur.', 'error');
        }
    });

    // ===== NOUVELLE LOGIQUE DE CONNEXION SIMPLIFIÉE ICI =====
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const playerTag = loginForm['login-player-tag'].value;

        if (!playerTag || !playerTag.startsWith('#')) {
            showMessage('Veuillez entrer un tag de joueur valide qui commence par #.', 'error');
            return;
        }

        showMessage('Vérification en cours...', 'success');

        try {
            // On appelle le nouvel endpoint /login
            const response = await fetch('https://brawlarena-gg.onrender.com/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ playerTag: playerTag }),
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage(data.error, 'error');
                return;
            }

            const playerData = data.player;
            let users = JSON.parse(localStorage.getItem('users')) || [];
            let user = users.find(u => u.playerTag === playerData.tag);

            // Si l'utilisateur n'existe pas en local, on le crée
            if (!user) {
                users.push({
                    username: playerData.name,
                    password: '', // Pas de mot de passe pour cette méthode
                    playerTag: playerData.tag,
                    inGameName: playerData.name
                });
                localStorage.setItem('users', JSON.stringify(users));
            }
            
            // On connecte l'utilisateur
            localStorage.setItem('loggedInUsername', playerData.name);
            
            showMessage(data.message, 'success');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

        } catch (error) {
            showMessage('Erreur de communication avec le serveur.', 'error');
        }
    });
});