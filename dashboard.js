document.addEventListener('DOMContentLoaded', () => {
    // Vérifie si un utilisateur est connecté, sinon redirige vers la page d'accueil
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    // Configuration de l'API
    const API_URL = 'https://brawlarena-gg.onrender.com';

    // Statut premium et stats journalières de l'utilisateur, stockés localement après la connexion
    let isCurrentUserPremium = localStorage.getItem('isPremium') === 'true';
    let userDailyStats = JSON.parse(localStorage.getItem('userDailyStats')) || { dailyScrims: 0 };

    // --- SÉLECTION DES ÉLÉMENTS DU DOM ---
    const utcClockElement = document.getElementById('utc-clock');
    const usernameDisplay = document.getElementById('username-display');
    const displayUsernameInNavbar = document.getElementById('display-username');
    const navbarPremiumBadge = document.getElementById('navbar-premium-badge');
    const logoutButton = document.getElementById('logout-button');
    const togglePremiumButton = document.getElementById('toggle-premium-button');
    const sortScrimsSelect = document.getElementById('sort-scrims');
    
    const sections = {
        home: document.getElementById('dashboard-home-section'),
        profile: document.getElementById('profile-section'),
        scrims: document.getElementById('scrims-section'),
        settings: document.getElementById('settings-section')
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

    const rankOrder = ['Légendaire I', 'Légendaire II', 'Légendaire III', 'Master I', 'Master II', 'Master III', 'Pro'];

    // --- FONCTIONS PRINCIPALES ---

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

                const sortMethod = sortScrimsSelect.value;
                if (sortMethod === 'time-asc') scrims.sort((a, b) => `${a.eventDate}T${a.startTime}`.localeCompare(`${b.eventDate}T${b.startTime}`));
                else if (sortMethod === 'rank-asc') scrims.sort((a, b) => rankOrder.indexOf(a.avgRank) - rankOrder.indexOf(b.avgRank));
                else if (sortMethod === 'rank-desc') scrims.sort((a, b) => rankOrder.indexOf(b.avgRank) - rankOrder.indexOf(a.avgRank));

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
                        gameIdHTML = isCreator
                            ? `<p><strong>ID Partie :</strong> <span class="game-id-container" data-scrim-id="${scrim._id}"><span class="game-id-text">${currentIdText}</span><button class="edit-id-button"><img src="images/edit.png" alt="Modifier"></button></span></p>`
                            : `<p><strong>ID Partie :</strong> ${currentIdText}</p>`;
                    } else {
                        gameIdHTML = `<p><strong>ID Partie :</strong> Rejoignez pour voir</p>`;
                    }

                    const scrimDate = new Date(`${scrim.eventDate}T00:00:00Z`);
                    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
                    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
                    const dateLabel = scrimDate.getTime() === today.getTime() ? "Aujourd'hui" : scrimDate.getTime() === tomorrow.getTime() ? "Demain" : scrimDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

                    card.innerHTML = `
                        ${adminDeleteIcon}
                        <h3>${scrim.roomName}</h3> ${gameIdHTML}
                        <p><strong>Rang Moyen :</strong> ${scrim.avgRank}</p>
                        <p><strong>Début (UTC) :</strong> ${dateLabel} à ${scrim.startTime}</p>
                        <div class="players-list"><strong>Joueurs (${scrim.players.length}/6) :</strong><ul>${playersHTML}</ul></div>
                        <div class="scrim-actions">${actionButtonHTML}</div>
                    `;
                    scrimsListContainer.appendChild(card);
                });
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
        // La partie tournois n'est pas implémentée côté serveur, on la met en non disponible
        profileDailyTournaments.textContent = 'N/A'; 
        profileDailyScrims.textContent = isCurrentUserPremium ? 'Illimité ✨' : Math.max(0, 2 - userDailyStats.dailyScrims);
    }

    function updateUtcClock() {
        const now = new Date();
        utcClockElement.textContent = `UTC ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;
    }

    function populateDateSelect() {
        const dateSelect = document.getElementById('scrim-date');
        const today = new Date();
        for (let i = 0; i < 3; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const label = i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            dateSelect.appendChild(option);
        }
    }

    function showSection(sectionToShow) {
        Object.values(sections).forEach(section => { if (section) section.style.display = 'none'; });
        if (sectionToShow) sectionToShow.style.display = 'block';
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

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

    sortScrimsSelect.addEventListener('change', renderScrims);

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
        const scrimData = {
            creator: loggedInUsername,
            eventDate: document.getElementById('scrim-date').value,
            roomName: document.getElementById('scrim-name').value,
            gameId: document.getElementById('scrim-game-id').value,
            avgRank: document.getElementById('scrim-rank').value,
            startTime: document.getElementById('scrim-start-time').value,
        };
        try {
            const response = await fetch(`${API_URL}/scrims`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scrimData) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erreur de création");
            
            if (!isCurrentUserPremium) {
                userDailyStats.dailyScrims++;
                userDailyStats.lastActivityDate = new Date().toISOString().split('T')[0];
                localStorage.setItem('userDailyStats', JSON.stringify(userDailyStats));
            }
            
            createScrimForm.reset();
            createScrimModal.style.display = 'none';
            await renderScrims();
        } catch (error) {
            alert(`Erreur: ${error.message}`);
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
                    if (!response.ok) throw new Error((await response.json()).error);
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

    links.scrims.addEventListener('click', async (e) => { e.preventDefault(); await renderScrims(); showSection(sections.scrims); });
    links.profile.addEventListener('click', (e) => { e.preventDefault(); updateProfileView(); showSection(sections.profile); });
    links.settings.addEventListener('click', (e) => { e.preventDefault(); showSection(sections.settings); });
    links.tournaments.addEventListener('click', (e) => { e.preventDefault(); alert('La section Tournois est en cours de développement !'); });
    if (links.about) links.about.addEventListener('click', (e) => { e.preventDefault(); alert("Section 'À propos' en cours de construction !"); });
    
    showScrimModalButton.addEventListener('click', () => { createScrimModal.style.display = 'flex'; });
    closeScrimModalButton.addEventListener('click', () => { createScrimModal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target == createScrimModal) createScrimModal.style.display = 'none'; });
    
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
    populateDateSelect();
    showSection(sections.home);
    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    setInterval(async () => { if (sections.scrims.style.display === 'block') await renderScrims(); }, 30000);
});