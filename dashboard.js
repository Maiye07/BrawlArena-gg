document.addEventListener('DOMContentLoaded', () => {
    // --- GESTION DE L'UTILISATEUR CONNECTÉ ---
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    // --- CONFIGURATION ---
    const API_URL = 'https://brawlarena-gg.onrender.com'; // Remplacez par http://localhost:3000 si vous testez en local

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

    // --- FONCTIONS ET VARIABLES DE TRI ---
    const rankOrder = ['Légendaire I', 'Légendaire II', 'Légendaire III', 'Master I', 'Master II', 'Master III', 'Pro'];

    // =================================================================
    // NOUVELLES FONCTIONS DE GESTION DES SCRIMS (VIA SERVEUR)
    // =================================================================

    /**
     * Récupère les scrims du serveur et les affiche dans le DOM.
     */
    async function renderScrims() {
        try {
            const response = await fetch(`${API_URL}/scrims`);
            if (!response.ok) {
                throw new Error('La récupération des scrims a échoué.');
            }
            let scrims = await response.json();
            const userStats = JSON.parse(localStorage.getItem('userStats')) || {};
            
            // Logique de tri
            const sortMethod = sortScrimsSelect.value;
            if (sortMethod === 'time-asc') {
                scrims.sort((a, b) => `${a.eventDate}T${a.startTime}`.localeCompare(`${b.eventDate}T${b.startTime}`));
            } else if (sortMethod === 'rank-asc') {
                scrims.sort((a, b) => rankOrder.indexOf(a.avgRank) - rankOrder.indexOf(b.avgRank));
            } else if (sortMethod === 'rank-desc') {
                scrims.sort((a, b) => rankOrder.indexOf(b.avgRank) - rankOrder.indexOf(a.avgRank));
            }

            scrimsListContainer.innerHTML = '';
            if (scrims.length === 0) {
                scrimsListContainer.innerHTML = '<p>Aucun scrim en cours. Soyez le premier à en créer un !</p>';
                return;
            }

            scrims.forEach(scrim => {
                const card = document.createElement('div');
                card.className = 'scrim-card';
                
                const isUserInScrim = scrim.players.includes(loggedInUsername);
                const isCreator = loggedInUsername === scrim.creator;
                const isFull = scrim.players.length >= 6;
                
                // Détermine quel bouton d'action afficher
                let actionButtonHTML = '';
                if (isUserInScrim) {
                    actionButtonHTML = `<button class="button leave-button" data-scrim-id="${scrim.id}">Quitter</button>`;
                } else if (!isFull) {
                    actionButtonHTML = `<button class="button join-button" data-scrim-id="${scrim.id}">Rejoindre</button>`;
                } else {
                    actionButtonHTML = `<button class="button" disabled>Plein</button>`;
                }

                // Construit la liste des joueurs avec leurs badges
                const playersHTML = scrim.players.map(player => {
                    const isPlayerCreator = player === scrim.creator;
                    const isPlayerPremium = userStats[player]?.isPremium || false;
                    const badges = isPlayerCreator ? `<img src="images/crown.png" alt="Créateur" class="creator-crown">` : '';
                    const playerNameHTML = `<span class="${isPlayerPremium ? 'premium-username' : ''}">${player}</span>`;
                    return `<li>${playerNameHTML} ${badges}</li>`;
                }).join('');

                // Gère l'affichage de l'ID de la partie
                let gameIdHTML = '';
                const currentIdText = scrim.gameId || 'Non défini';
                if (isUserInScrim) {
                    gameIdHTML = isCreator
                        ? `<p><strong>ID Partie :</strong> <span class="game-id-container" data-scrim-id="${scrim.id}"><span class="game-id-text">${currentIdText}</span><button class="edit-id-button"><img src="images/edit.png" alt="Modifier"></button></span></p>`
                        : `<p><strong>ID Partie :</strong> ${currentIdText}</p>`;
                } else {
                    gameIdHTML = `<p><strong>ID Partie :</strong> Rejoignez pour voir</p>`;
                }
                
                // Formate la date pour l'affichage
                const scrimDate = new Date(`${scrim.eventDate}T00:00:00Z`);
                const today = new Date(); today.setUTCHours(0,0,0,0);
                const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
                let dateLabel = scrimDate.getTime() === today.getTime() ? "Aujourd'hui" : scrimDate.getTime() === tomorrow.getTime() ? "Demain" : scrimDate.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'});

                // Remplit la carte avec toutes les informations
                card.innerHTML = `
                    <h3>${scrim.roomName}</h3>
                    ${gameIdHTML}
                    <p><strong>Rang Moyen :</strong> ${scrim.avgRank}</p>
                    <p><strong>Début (UTC) :</strong> ${dateLabel} à ${scrim.startTime}</p>
                    <div class="players-list">
                        <strong>Joueurs (${scrim.players.length}/6) :</strong>
                        <ul>${playersHTML}</ul>
                    </div>
                    <div class="scrim-actions">${actionButtonHTML}</div>
                `;
                scrimsListContainer.appendChild(card);
            });
        } catch (error) {
            scrimsListContainer.innerHTML = `<p class="error">Erreur de chargement des scrims : ${error.message}</p>`;
        }
    }

    // =================================================================
    // FONCTIONS UTILITAIRES (INCHANGÉES)
    // =================================================================

    function updateUtcClock() {
        const now = new Date();
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        utcClockElement.textContent = `UTC ${hours}:${minutes}:${seconds}`;
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
        Object.values(sections).forEach(section => section.style.display = 'none');
        sectionToShow.style.display = 'block';
    }

    function updatePremiumDisplay() {
        const userStats = JSON.parse(localStorage.getItem('userStats'));
        const isPremium = userStats[loggedInUsername]?.isPremium || false;
        navbarPremiumBadge.innerHTML = isPremium ? `<img src="images/Certif.png" alt="Premium" class="premium-badge">` : '';
        displayUsernameInNavbar.classList.toggle('premium-username', isPremium);
    }
    
    function updateProfileView() {
        const userStats = JSON.parse(localStorage.getItem('userStats'))[loggedInUsername];
        const usersPlayerIDs = JSON.parse(localStorage.getItem('usersPlayerIDs')) || {};
        profileUsername.textContent = loggedInUsername;
        profilePlayerId.textContent = usersPlayerIDs[loggedInUsername] || "Non défini";
        profileTournamentsAttended.textContent = userStats.tournamentsAttended;
        profileScrimsAttended.textContent = userStats.scrimsAttended;
        profileTournamentsWon.textContent = userStats.tournamentsWon;
        profileDailyTournaments.textContent = userStats.isPremium ? 'Illimité ✨' : Math.max(0, 1 - userStats.dailyTournaments);
        profileDailyScrims.textContent = userStats.isPremium ? 'Illimité ✨' : Math.max(0, 2 - userStats.dailyScrims);
    }

    function initializeUserStats() {
        let userStats = JSON.parse(localStorage.getItem('userStats')) || {};
        const today = new Date().toISOString().split('T')[0];
        if (!userStats[loggedInUsername]) {
            userStats[loggedInUsername] = { tournamentsAttended: 0, scrimsAttended: 0, tournamentsWon: 0, lastParticipationDate: today, dailyTournaments: 0, dailyScrims: 0, isPremium: false };
        } else {
            if (userStats[loggedInUsername].isPremium === undefined) userStats[loggedInUsername].isPremium = false;
            if (userStats[loggedInUsername].lastParticipationDate !== today) {
                userStats[loggedInUsername].dailyTournaments = 0;
                userStats[loggedInUsername].dailyScrims = 0;
                userStats[loggedInUsername].lastParticipationDate = today;
            }
        }
        localStorage.setItem('userStats', JSON.stringify(userStats));
    }

    // =================================================================
    // GESTIONNAIRES D'ÉVÉNEMENTS
    // =================================================================

    // --- Actions sur les Scrims ---
    
    sortScrimsSelect.addEventListener('change', renderScrims);

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
            const response = await fetch(`${API_URL}/scrims`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scrimData),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Erreur de création");
            }

            let userStats = JSON.parse(localStorage.getItem('userStats'));
            if (!userStats[loggedInUsername].isPremium) {
                userStats[loggedInUsername].dailyScrims++;
            }
            localStorage.setItem('userStats', JSON.stringify(userStats));

            createScrimForm.reset();
            createScrimModal.style.display = 'none';
            await renderScrims();
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    });

    scrimsListContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        // Gérer le clic sur le bouton "Modifier ID"
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

        // Gérer le clic sur les boutons d'action (Rejoindre, Quitter, Sauvegarder ID)
        try {
            let response;
            if (button.classList.contains('join-button')) {
                response = await fetch(`${API_URL}/scrims/${scrimId}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername }),
                });
            } else if (button.classList.contains('leave-button')) {
                response = await fetch(`${API_URL}/scrims/${scrimId}/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername }),
                });
            } else if (button.classList.contains('save-id-button')) {
                const newId = button.parentElement.querySelector('.edit-id-input').value.trim();
                response = await fetch(`${API_URL}/scrims/${scrimId}/gameid`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameId: newId }),
                });
            }

            if (response && !response.ok) {
                const err = await response.json();
                throw new Error(err.error);
            }
            await renderScrims();
        } catch (error) {
            alert(error.message);
        }
    });

    // --- Navigation et autres actions ---

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('loggedInUsername');
        window.location.href = 'index.html';
    });

    links.scrims.addEventListener('click', async (e) => {
        e.preventDefault();
        await renderScrims();
        showSection(sections.scrims);
    });

    links.profile.addEventListener('click', (e) => { e.preventDefault(); updateProfileView(); showSection(sections.profile); });
    links.settings.addEventListener('click', (e) => { e.preventDefault(); showSection(sections.settings); });
    links.tournaments.addEventListener('click', (e) => { e.preventDefault(); alert('La section Tournois est en cours de développement !'); });
    if (links.about) links.about.addEventListener('click', (e) => { e.preventDefault(); alert("Section 'À propos' en cours de construction !"); });

    showScrimModalButton.addEventListener('click', () => { createScrimModal.style.display = 'flex'; });
    closeScrimModalButton.addEventListener('click', () => createScrimModal.style.display = 'none');
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

    togglePremiumButton.addEventListener('click', () => {
        let userStats = JSON.parse(localStorage.getItem('userStats'));
        userStats[loggedInUsername].isPremium = !userStats[loggedInUsername].isPremium;
        localStorage.setItem('userStats', JSON.stringify(userStats));
        updatePremiumDisplay();
        if (sections.profile.style.display === 'block') updateProfileView();
        if (sections.scrims.style.display === 'block') renderScrims();
        alert(`Statut Premium ${userStats[loggedInUsername].isPremium ? 'activé' : 'désactivé'} !`);
    });

    // =================================================================
    // INITIALISATION DE LA PAGE
    // =================================================================

    usernameDisplay.textContent = loggedInUsername;
    displayUsernameInNavbar.textContent = loggedInUsername;
    initializeUserStats();
    updatePremiumDisplay();
    populateDateSelect();
    showSection(sections.home);
    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    
    // Rafraîchit la liste des scrims toutes les 30 secondes pour voir les mises à jour
    setInterval(async () => {
        if (sections.scrims.style.display === 'block') {
            await renderScrims();
        }
    }, 30000);
});