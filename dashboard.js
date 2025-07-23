document.addEventListener('DOMContentLoaded', () => {
    // Vérifie si un utilisateur est connecté, sinon redirige vers la page d'accueil
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    // Configuration de l'API
    const API_URL = 'https://brawlarena-gg.onrender.com';

    // Données de l'utilisateur stockées localement
    let isCurrentUserPremium = localStorage.getItem('isPremium') === 'true';
    let userDailyStats = JSON.parse(localStorage.getItem('userDailyStats')) || { dailyScrims: 0 };

    // --- SÉLECTION DES ÉLÉMENTS DU DOM ---
    const utcClockElement = document.getElementById('utc-clock');
    const usernameDisplay = document.getElementById('username-display');
    const displayUsernameInNavbar = document.getElementById('display-username');
    const navbarPremiumBadge = document.getElementById('navbar-premium-badge');
    const logoutButton = document.getElementById('logout-button');
    const togglePremiumButton = document.getElementById('toggle-premium-button');
    
    const sections = {
        home: document.getElementById('dashboard-home-section'),
        profile: document.getElementById('profile-section'),
        scrims: document.getElementById('scrims-section'),
        settings: document.getElementById('settings-section'),
        about: document.getElementById('about-section')
    };

    const links = {
        profile: document.getElementById('profile-link'),
        tournaments: document.getElementById('tournaments-link'),
        scrims: document.getElementById('scrims-link'),
        settings: document.getElementById('settings-link'),
        about: document.getElementById('about-link')
    };

    const scrimsListContainer = document.getElementById('scrims-list-container');
    const showScrimModalButton = document.getElementById('show-scrim-modal-button');
    const createScrimModal = document.getElementById('create-scrim-modal');
    const closeScrimModalButton = document.querySelector('.modal-close-button');
    const createScrimForm = document.getElementById('create-scrim-form');
    
    const profileUsername = document.getElementById('profile-username');
    const profilePlayerId = document.getElementById('profile-player-id');
    const profileTournamentsAttended = document.getElementById('profile-tournaments-attended');
    const profileScrimsAttended = document.getElementById('profile-scrims-attended');
    const profileTournamentsWon = document.getElementById('profile-tournaments-won');
    const profileDailyTournaments = document.getElementById('profile-daily-tournaments');
    const profileDailyScrims = document.getElementById('profile-daily-scrims');

    const playerIdForm = document.getElementById('supercell-id-form');
    const playerIdInput = document.getElementById('player-id-input');
    const settingsMessage = document.getElementById('settings-message');

    const showUsersButton = document.getElementById('show-users-button');
    const usersListContainer = document.getElementById('users-list-container');

    // --- FONCTIONS ---
    function updateAllCountdowns() {
        const countdownElements = document.querySelectorAll('.countdown-timer');
        countdownElements.forEach(element => {
            const startTime = new Date(element.dataset.startTime);
            const now = new Date();
            const diff = startTime - now;
            if (diff <= 0) {
                element.innerHTML = `<span style="color: var(--success-color);">Commencé</span>`;
                return;
            }
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            element.textContent = `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
        });
    }

    async function renderScrims() {
        try {
            const scrimsResponse = await fetch(`${API_URL}/scrims`);
            if (!scrimsResponse.ok) throw new Error('La récupération des scrims a échoué.');
            let scrims = await scrimsResponse.json();
            if (scrims.length > 0) {
                const allUsernames = new Set();
                scrims.forEach(scrim => scrim.players.forEach(player => allUsernames.add(player)));
                const statusesResponse = await fetch(`${API_URL}/users/statuses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: Array.from(allUsernames) })
                });
                const premiumStatus = await statusesResponse.json();
                scrimsListContainer.innerHTML = '';
                scrims.forEach(scrim => {
                    const card = document.createElement('div');
                    card.className = 'scrim-card';
                    let adminDeleteIcon = '';
                    if (loggedInUsername.toLowerCase() === 'brawlarena.gg') {
                        adminDeleteIcon = `<span class="admin-delete-scrim" data-scrim-id="${scrim._id}" title="Supprimer le scrim">🗑️</span>`;
                    }
                    const playersHTML = scrim.players.map(player => {
                        const isPlayerPremium = premiumStatus[player] || false;
                        const isPlayerCreator = player === scrim.creator;
                        const badges = isPlayerCreator ? `<img src="images/crown.png" alt="Créateur" class="creator-crown">` : '';
                        const playerNameHTML = `<span class="${isPlayerPremium ? 'premium-username' : ''}">${player}</span>`;
                        return `<li>${playerNameHTML} ${badges}</li>`;
                    }).join('');
                    const isUserInScrim = scrim.players.includes(loggedInUsername);
                    const isCreator = loggedInUsername === scrim.creator;
                    const isFull = scrim.players.length >= 6;
                    const actionButtonHTML = isUserInScrim ? `<button class="button leave-button" data-scrim-id="${scrim._id}">Quitter</button>` : (!isFull ? `<button class="button join-button" data-scrim-id="${scrim._id}">Rejoindre</button>` : `<button class="button" disabled>Plein</button>`);
                    let gameIdHTML = '';
                    const currentIdText = scrim.gameId || 'Non défini';
                    if (isUserInScrim) {
                        gameIdHTML = isCreator ?
                            `<p><strong>ID Partie :</strong> <span class="game-id-container" data-scrim-id="${scrim._id}"><span class="game-id-text">${currentIdText}</span><button class="edit-id-button"><img src="images/edit.png" alt="Modifier"></button></span></p>` :
                            `<p><strong>ID Partie :</strong> ${currentIdText}</p>`;
                    } else {
                        gameIdHTML = `<p><strong>ID Partie :</strong> Rejoignez pour voir</p>`;
                    }
                    const countdownHTML = `<p><strong>Commence dans :</strong> <span class="countdown-timer" data-start-time="${scrim.startTime}">Calcul...</span></p>`;
                    card.innerHTML = `
                        ${adminDeleteIcon}
                        <h3>${scrim.roomName}</h3> ${gameIdHTML}
                        <p><strong>Rang Moyen :</strong> ${scrim.avgRank}</p>
                        ${countdownHTML}
                        <div class="players-list"><strong>Joueurs (${scrim.players.length}/6) :</strong><ul>${playersHTML}</ul></div>
                        <div class="scrim-actions">${actionButtonHTML}</div>
                    `;
                    scrimsListContainer.appendChild(card);
                });
                updateAllCountdowns();
            } else {
                scrimsListContainer.innerHTML = '<p>Aucun scrim en cours. Soyez le premier à en créer un !</p>';
            }
        } catch (error) {
            scrimsListContainer.innerHTML = `<p class="error">Erreur de chargement des scrims : ${error.message}</p>`;
        }
    }

    function updatePremiumDisplay() {
        navbarPremiumBadge.innerHTML = isCurrentUserPremium ? `<img src="images/Certif.png" alt="Premium" class="premium-badge">` : '';
        displayUsernameInNavbar.classList.toggle('premium-username', isCurrentUserPremium);
    }

    function updateProfileView() {
        const today = new Date().toISOString().split('T')[0];
        if (userDailyStats.lastActivityDate !== today) {
            userDailyStats.dailyScrims = 0;
        }
        profileUsername.textContent = loggedInUsername;
        profileDailyTournaments.textContent = 'N/A';
        profileDailyScrims.textContent = isCurrentUserPremium ? 'Illimité ✨' : Math.max(0, 2 - userDailyStats.dailyScrims);
    }

    function updateUtcClock() {
        const now = new Date();
        utcClockElement.textContent = `UTC ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;
    }

    function showSection(sectionToShow) {
        Object.values(sections).forEach(section => { if (section) section.style.display = 'none'; });
        if (sectionToShow) sectionToShow.style.display = 'block';
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

    // NOUVEL ÉVÉNEMENT : Clic sur le pseudo dans la barre de navigation
    displayUsernameInNavbar.addEventListener('click', (e) => {
        e.preventDefault();
        updateProfileView();
        showSection(sections.profile);
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('loggedInUsername');
        localStorage.removeItem('isPremium');
        localStorage.removeItem('userDailyStats');
        window.location.href = 'index.html';
    });

    togglePremiumButton.addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_URL}/premium/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loggedInUsername })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            isCurrentUserPremium = data.isPremium;
            localStorage.setItem('isPremium', isCurrentUserPremium);
            updatePremiumDisplay();
            updateProfileView();
            if (sections.scrims.style.display === 'block') await renderScrims();
            alert(`Statut Premium ${isCurrentUserPremium ? 'activé' : 'désactivé'} !`);
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    });

    showUsersButton.addEventListener('click', async () => {
        try {
            usersListContainer.innerHTML = '<p>Chargement des comptes...</p>';
            const response = await fetch(`${API_URL}/users?requestingUser=${encodeURIComponent(loggedInUsername)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Une erreur est survenue.");
            }
            const users = await response.json();
            if (users.length === 0) {
                usersListContainer.innerHTML = '<p>Aucun compte enregistré.</p>';
                return;
            }
            let usersHTML = '<h3>Comptes enregistrés :</h3><ul>';
            users.forEach(user => { usersHTML += `<li>${user.username}</li>`; });
            usersHTML += '</ul>';
            usersListContainer.innerHTML = usersHTML;
        } catch (error) {
            usersListContainer.innerHTML = `<p class="error">${error.message}</p>`;
        }
    });

    showScrimModalButton.addEventListener('click', () => {
        updateProfileView();
        if (!isCurrentUserPremium && userDailyStats.dailyScrims >= 2) {
            alert("Vous avez atteint votre limite de création de 2 scrims pour aujourd'hui.");
            return;
        }
        createScrimModal.style.display = 'flex';
    });

    createScrimForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = createScrimForm.querySelector('button[type="submit"]');
        const hours = parseInt(document.getElementById('scrim-hours').value) || 0;
        const minutes = parseInt(document.getElementById('scrim-minutes').value) || 0;
        const totalMinutes = (hours * 60) + minutes;
        if (totalMinutes <= 0 || totalMinutes > 2880) {
            alert("La durée doit être comprise entre 1 minute et 48 heures.");
            return;
        }
        const scrimData = {
            creator: loggedInUsername,
            roomName: document.getElementById('scrim-name').value,
            gameId: document.getElementById('scrim-game-id').value,
            avgRank: document.getElementById('scrim-rank').value,
            startsInMinutes: totalMinutes,
        };
        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Création...';
            const response = await fetch(`${API_URL}/scrims`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scrimData) });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Erreur de création");
            }
            if (!isCurrentUserPremium) {
                userDailyStats.dailyScrims++;
                userDailyStats.lastActivityDate = new Date().toISOString().split('T')[0];
                localStorage.setItem('userDailyStats', JSON.stringify(userDailyStats));
            }
            createScrimForm.reset();
            document.getElementById('scrim-hours').value = 0;
            document.getElementById('scrim-minutes').value = 30;
            createScrimModal.style.display = 'none';
            await renderScrims();
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Créer le salon';
        }
    });

    scrimsListContainer.addEventListener('click', async (e) => {
        const deleteIcon = e.target.closest('.admin-delete-scrim');
        if (deleteIcon) {
            const scrimId = deleteIcon.dataset.scrimId;
            if (confirm('Êtes-vous sûr de vouloir supprimer définitivement ce scrim ?')) {
                try {
                    const response = await fetch(`${API_URL}/scrims/${scrimId}?requestingUser=${encodeURIComponent(loggedInUsername)}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error);
                    }
                    await renderScrims();
                } catch (error) {
                    alert(`Erreur: ${error.message}`);
                }
            }
            return;
        }

        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('edit-id-button')) {
            const container = button.closest('.game-id-container');
            const scrimId = container.dataset.scrimId;
            const textSpan = container.querySelector('.game-id-text');
            const currentId = textSpan.textContent;
            container.innerHTML = `<input type="text" class="edit-id-input" value="${currentId === 'Non défini' ? '' : currentId}" placeholder="ID de la partie"><button class="save-id-button" data-scrim-id="${scrimId}"><img src="images/confirme.png" alt="Confirmer"></button>`;
            container.querySelector('.edit-id-input').focus();
            return;
        }

        const scrimId = button.dataset.scrimId;
        if (!scrimId) return;

        try {
            let response;
            if (button.classList.contains('join-button')) {
                response = await fetch(`${API_URL}/scrims/${scrimId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUsername }) });
            } else if (button.classList.contains('leave-button')) {
                response = await fetch(`${API_URL}/scrims/${scrimId}/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUsername }) });
            } else if (button.classList.contains('save-id-button')) {
                const newId = button.parentElement.querySelector('.edit-id-input').value.trim();
                response = await fetch(`${API_URL}/scrims/${scrimId}/gameid`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: newId }) });
            }
            if (response && !response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Une erreur inconnue est survenue.");
            }
            await renderScrims();
        } catch (error) {
            alert(error.message);
        }
    });

    // --- NAVIGATION ---
    links.scrims.addEventListener('click', async (e) => { e.preventDefault(); await renderScrims(); showSection(sections.scrims); });
    links.profile.addEventListener('click', (e) => { e.preventDefault(); updateProfileView(); showSection(sections.profile); });
    links.settings.addEventListener('click', (e) => { e.preventDefault(); showSection(sections.settings); });
    links.tournaments.addEventListener('click', (e) => { e.preventDefault(); alert('La section Tournois est en cours de développement !'); });
    if (links.about) {
        links.about.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(sections.about);
        });
    }
    
    // --- MODALE ---
    closeScrimModalButton.addEventListener('click', () => { createScrimModal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target == createScrimModal) createScrimModal.style.display = 'none'; });
    
    // --- PARAMÈTRES ---
    playerIdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const playerInfo = playerIdInput.value.trim();
        if (playerInfo) {
            let usersPlayerIDs = JSON.parse(localStorage.getItem('usersPlayerIDs')) || {};
            usersPlayerIDs[loggedInUsername] = playerInfo;
            localStorage.setItem('usersPlayerIDs', JSON.stringify(usersPlayerIDs));
            settingsMessage.textContent = 'Enregistré avec succès !';
            settingsMessage.className = 'success';
        } else {
            settingsMessage.textContent = 'Veuillez entrer une information valide.';
            settingsMessage.className = 'error';
        }
    });

    // --- INITIALISATION DE LA PAGE ---
    usernameDisplay.textContent = loggedInUsername;
    displayUsernameInNavbar.textContent = loggedInUsername;
    updatePremiumDisplay();
    updateProfileView();
    showSection(sections.home);
    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    setInterval(updateAllCountdowns, 1000);
});