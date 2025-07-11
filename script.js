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

    // ===================================================================
    // FONCTION MANQUANTE À AJOUTER ICI
    // ===================================================================
    function showMessage(msg, type) {
        messageDisplay.textContent = msg;
        messageDisplay.className = type; // Applique la classe 'success' ou 'error'
    }
    // ===================================================================

    // Handle click on "Log In / Sign Up" button in the navbar
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

    // Handle switching between Register and Login forms
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

    // Handle register form submission
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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ playerTag: playerTag }),
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage(`Erreur : ${data.error || 'Tag joueur non valide.'}`, 'error');
                return;
            }
            
            const brawlStarsData = data;

            users.push({
                username: username,
                password: password,
                playerTag: brawlStarsData.tag,
                inGameName: brawlStarsData.name
            });

            localStorage.setItem('users', JSON.stringify(users));
            showMessage(`Compte créé pour ${brawlStarsData.name} ! Vous pouvez vous connecter.`, 'success');

            setTimeout(() => {
                registerSection.style.display = 'none';
                loginSection.style.display = 'block';
                messageDisplay.textContent = '';
                registerForm.reset();
            }, 2000);

        } catch (error) {
            console.error("Erreur lors de l'inscription:", error);
            if (error instanceof TypeError) {
                 showMessage('Erreur de communication. Vérifiez la console (F12) (problème de "Mixed Content" ?)', 'error');
            } else {
                 showMessage('Une erreur inattendue est survenue.', 'error');
            }
        }
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const playerTag = loginForm['login-player-tag'].value;

        if (!playerTag || !playerTag.startsWith('#')) {
            showMessage('Veuillez entrer un tag de joueur valide qui commence par #.', 'error');
            return;
        }

        showMessage('Vérification en cours...', 'success');

        try {
            const response = await fetch('https://brawlarena-gg.onrender.com/login-by-action', {
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

            if (!user) {
                users.push({
                    username: playerData.name,
                    password: '',
                    playerTag: playerData.tag,
                    inGameName: playerData.name
                });
                localStorage.setItem('users', JSON.stringify(users));
            }

            localStorage.setItem('loggedInUsername', playerData.name);
            
            showMessage(data.message, 'success');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

        } catch (error) {
            console.error('Erreur lors de la tentative de connexion par action:', error);
             if (error instanceof TypeError) {
                showMessage('Erreur de communication. Vérifiez la console (F12) (problème de "Mixed Content" ?)', 'error');
            } else {
                showMessage('Une erreur inattendue est survenue.', 'error');
            }
        }
    });
});