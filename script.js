document.addEventListener('DOMContentLoaded', () => {
    // Sélection des éléments
    const registerSection = document.getElementById('register-section');
    const loginSection = document.getElementById('login-section');
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const showLoginLink = document.getElementById('show-login');
    const showRegisterLink = document.getElementById('show-register');
    const messageDisplay = document.getElementById('message');

    // Afficher le formulaire de connexion
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
        messageDisplay.textContent = '';
    });

    // Afficher le formulaire d'inscription
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
        messageDisplay.textContent = '';
    });

    // Logique d'inscription
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;

        // On récupère les utilisateurs existants ou un tableau vide
        const users = JSON.parse(localStorage.getItem('users')) || [];

        // On vérifie si l'utilisateur existe déjà
        if (users.find(user => user.username === username)) {
            messageDisplay.textContent = 'Ce nom d\'utilisateur est déjà pris.';
            messageDisplay.className = 'error';
            return;
        }

        // On ajoute le nouvel utilisateur
        users.push({ username, password });
        
        // On sauvegarde la liste mise à jour
        localStorage.setItem('users', JSON.stringify(users));

        messageDisplay.textContent = 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.';
        messageDisplay.className = 'success';
        registerForm.reset();
    });

    // Logique de connexion
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const users = JSON.parse(localStorage.getItem('users')) || [];

        // On cherche un utilisateur avec le bon pseudo ET le bon mot de passe
        const user = users.find(user => user.username === username && user.password === password);

        if (user) {
            // Si l'utilisateur est trouvé, on le connecte
            localStorage.setItem('loggedInUser', username);
            window.location.href = 'dashboard.html'; // Redirection vers le tableau de bord
        } else {
            // Sinon, on affiche une erreur
            messageDisplay.textContent = 'Nom d\'utilisateur ou mot de passe incorrect.';
            messageDisplay.className = 'error';
        }
    });
});