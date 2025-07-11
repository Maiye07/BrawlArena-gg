document.addEventListener('DOMContentLoaded', () => {
    // --- GESTION DE L'UTILISATEUR CONNECTÉ ---
    const loggedInUsername = localStorage.getItem('loggedInUsername');

    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

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
    
    const rankOrder = [
        'Légendaire I', 'Légendaire II', 'Légendaire III',
        'Master I', 'Master II', 'Master III', 'Pro'
    ];

    // --- FONCTIONS PRINCIPALES ---

    function updateUtcClock() {
        const now = new Date();
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        utcClockElement.textContent = `UTC ${hours}:${minutes}:${seconds}`;
    }

    function removeExpiredScrims() {
        let scrims = JSON.parse(localStorage.getItem('scrimsList')) || [];
        if (scrims.length === 0) return;

        const now = new Date();
        
        const activeScrims = scrims.filter(scrim => {
            if (!scrim.eventDate || !scrim.startTime) {
                return false;
            }
            
            const [hours, minutes] = scrim.startTime.split(':');
            const scrimStartDateTime = new Date(`${scrim.eventDate}T${hours}:${minutes}:00Z`);

            return scrimStartDateTime > now;
        });

        if (activeScrims.length < scrims.length) {
            localStorage.setItem('scrimsList', JSON.stringify(activeScrims));
            if (sections.scrims.style.display === 'block') {
                renderScrims();
            }
        }
    }

    function populateDateSelect() {
        const dateSelect = document.getElementById('scrim-date');
        const today = new Date();

        for (let i = 0; i < 3; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const value = `${year}-${month}-${day}`;

            let label = '';
            if (i === 0) {
                label = "Aujourd'hui";
            } else if (i === 1) {
                label = "Demain";
            } else {
                label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            }
            
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            dateSelect.appendChild(option);
        }
    }

    function showSection(sectionToShow) {
        Object.values(sections).forEach(section => { if(section) section.style.display = 'none'; });
        if(sectionToShow) sectionToShow.style.display = 'block';
    }

    // CORRECTION : La fonction gère maintenant l'ajout/retrait de la classe pour le style
    function updatePremiumDisplay() {
        const userStats = JSON.parse(localStorage.getItem('userStats'));
        const isPremium = userStats[loggedInUsername]?.isPremium || false;

        navbarPremiumBadge.innerHTML = '';
        displayUsernameInNavbar.classList.remove('premium-username'); 

        if (isPremium) {
            navbarPremiumBadge.innerHTML = `<img src="images/Certif.png" alt="Premium" class="premium-badge">`;
            displayUsernameInNavbar.classList.add('premium-username');
        }
    }
    
    function updateProfileView() {
        const userStats = JSON.parse(localStorage.getItem('userStats'))[loggedInUsername];
        const usersPlayerIDs = JSON.parse(localStorage.getItem('usersPlayerIDs')) || {};
        const tournamentDailyLimit = 1;
        const scrimDailyLimit = 2;

        profileUsername.textContent = loggedInUsername;
        profilePlayerId.textContent = usersPlayerIDs[loggedInUsername] || "Non défini";
        
        profileTournamentsAttended.textContent = userStats.tournamentsAttended;
        profileScrimsAttended.textContent = userStats.scrimsAttended;
        profileTournamentsWon.textContent = userStats.tournamentsWon;

        if (userStats.isPremium) {
            profileDailyTournaments.textContent = 'Illimité ✨';
            profileDailyScrims.textContent = 'Illimité ✨';
        } else {
            profileDailyTournaments.textContent = Math.max(0, tournamentDailyLimit - userStats.dailyTournaments);
            profileDailyScrims.textContent = Math.max(0, scrimDailyLimit - userStats.dailyScrims);
        }
    }

    function initializeUserStats() {
        let userStats = JSON.parse(localStorage.getItem('userStats')) || {};
        const today = new Date().toISOString().split('T')[0];
        
        if (!userStats[loggedInUsername]) {
            userStats[loggedInUsername] = {
                tournamentsAttended: 0, scrimsAttended: 0, tournamentsWon: 0,
                lastParticipationDate: today, dailyTournaments: 0, dailyScrims: 0,
                isPremium: false
            };
        } else {
            if (userStats[loggedInUsername].isPremium === undefined) {
                userStats[loggedInUsername].isPremium = false;
            }
            if (userStats[loggedInUsername].lastParticipationDate !== today) {
                userStats[loggedInUsername].dailyTournaments = 0;
                userStats[loggedInUsername].dailyScrims = 0;
                userStats[loggedInUsername].lastParticipationDate = today;
            }
        }
        localStorage.setItem('userStats', JSON.stringify(userStats));
    }

    function renderScrims() {
        let scrims = JSON.parse(localStorage.getItem('scrimsList')) || [];
        const userStats = JSON.parse(localStorage.getItem('userStats')) || {};
        const sortMethod = sortScrimsSelect.value;

        if (sortMethod === 'time-asc') {
            scrims.sort((a, b) => {
                const dateTimeA = `${a.eventDate}T${a.startTime}`;
                const dateTimeB = `${b.eventDate}T${b.startTime}`;
                return dateTimeA.localeCompare(dateTimeB);
            });
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
            
            let actionButtonHTML = '';
            if (isUserInScrim) {
                actionButtonHTML = `<button class="button leave-button" data-scrim-id="${scrim.id}">Quitter</button>`;
            } else if (!isFull) {
                actionButtonHTML = `<button class="button join-button" data-scrim-id="${scrim.id}">Rejoindre</button>`;
            } else {
                actionButtonHTML = `<button class="button" disabled>Plein</button>`;
            }

            const playersHTML = scrim.players.map(player => {
                const isPlayerCreator = player === scrim.creator;
                const isPlayerPremium = userStats[player]?.isPremium || false;
                
                let badges = '';
                if (isPlayerCreator) {
                    badges += `<img src="images/crown.png" alt="Créateur" class="creator-crown">`;
                }
                
                const playerNameHTML = `<span class="${isPlayerPremium ? 'premium-username' : ''}">${player}</span>`;

                return `<li>${playerNameHTML} ${badges}</li>`;
            }).join('');

            let gameIdHTML = '';
            const currentIdText = scrim.gameId || 'Non défini';

            if (isUserInScrim) {
                if (isCreator) {
                    gameIdHTML = `<p><strong>ID Partie :</strong> <span class="game-id-container" data-scrim-id="${scrim.id}">
                                    <span class="game-id-text">${currentIdText}</span>
                                    <button class="edit-id-button"><img src="images/edit.png" alt="Modifier"></button>
                                  </span></p>`;
                } else {
                    gameIdHTML = `<p><strong>ID Partie :</strong> ${currentIdText}</p>`;
                }
            } else {
                gameIdHTML = `<p><strong>ID Partie :</strong> Rejoignez pour voir</p>`;
            }

            const scrimDate = new Date(`${scrim.eventDate}T00:00:00Z`);
            const today = new Date();
            today.setUTCHours(0,0,0,0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            let dateLabel = '';
            if (scrimDate.getTime() === today.getTime()) {
                dateLabel = "Aujourd'hui";
            } else if (scrimDate.getTime() === tomorrow.getTime()) {
                dateLabel = "Demain";
            } else {
                dateLabel = scrimDate.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'});
            }

            card.innerHTML = `
                <h3>${scrim.roomName}</h3>
                ${gameIdHTML}
                <p><strong>Rang Moyen :</strong> ${scrim.avgRank}</p>
                <p><strong>Début (UTC) :</strong> ${dateLabel} à ${scrim.startTime}</p>
                <div class="players-list">
                    <strong>Joueurs (${scrim.players.length}/6) :</strong>
                    <ul>${playersHTML}</ul>
                </div>
                <div class="scrim-actions">
                    ${actionButtonHTML}
                </div>
            `;
            scrimsListContainer.appendChild(card);
        });
    }

    // --- INITIALISATION DE LA PAGE ---
    usernameDisplay.textContent = loggedInUsername;
    displayUsernameInNavbar.textContent = loggedInUsername;
    initializeUserStats();
    updatePremiumDisplay();
    populateDateSelect();
    showSection(sections.home);
    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    setInterval(removeExpiredScrims, 10000); 

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    
    sortScrimsSelect.addEventListener('change', renderScrims);

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('loggedInUsername');
        window.location.href = 'index.html';
    });

    togglePremiumButton.addEventListener('click', () => {
        let userStats = JSON.parse(localStorage.getItem('userStats'));
        userStats[loggedInUsername].isPremium = !userStats[loggedInUsername].isPremium;
        localStorage.setItem('userStats', JSON.stringify(userStats));
        
        updatePremiumDisplay();
        if (sections.profile.style.display === 'block') {
            updateProfileView();
        }
        if (sections.scrims.style.display === 'block') {
            renderScrims();
        }
        alert(`Statut Premium ${userStats[loggedInUsername].isPremium ? 'activé' : 'désactivé'} !`);
    });
    
    links.tournaments.addEventListener('click', (e) => {
        e.preventDefault();
        const userStats = JSON.parse(localStorage.getItem('userStats'))[loggedInUsername];
        if (!userStats.isPremium && userStats.dailyTournaments >= 1) {
            alert("Vous avez atteint votre limite de création de 1 tournoi pour aujourd'hui. Passez Premium pour des créations illimitées !");
            return;
        }
        alert('La section Tournois est en cours de développement !');
    });

    links.scrims.addEventListener('click', (e) => {
        e.preventDefault();
        renderScrims();
        showSection(sections.scrims);
    });

    links.profile.addEventListener('click', (e) => {
        e.preventDefault();
        updateProfileView();
        showSection(sections.profile);
    });

    links.settings.addEventListener('click', (e) => {
        e.preventDefault();
        const usersPlayerIDs = JSON.parse(localStorage.getItem('usersPlayerIDs')) || {};
        playerIdInput.value = usersPlayerIDs[loggedInUsername] || '';
        settingsMessage.textContent = '';
        showSection(sections.settings);
    });

    if (links.about) {
        links.about.addEventListener('click', (e) => {
            e.preventDefault();
            alert("Section 'À propos' en cours de construction !");
        });
    }

    showScrimModalButton.addEventListener('click', () => {
        const allScrims = JSON.parse(localStorage.getItem('scrimsList')) || [];
        const scrimsJoined = allScrims.filter(s => s.players.includes(loggedInUsername)).length;

        if (scrimsJoined >= 2) {
            alert("Vous ne pouvez pas créer de scrim car vous avez déjà rejoint le nombre maximum de 2 scrims.");
            return;
        }

        const userStats = JSON.parse(localStorage.getItem('userStats'))[loggedInUsername];
        if (!userStats.isPremium && userStats.dailyScrims >= 2) {
            alert("Vous avez atteint votre limite de création de 2 scrims pour aujourd'hui. Passez Premium pour des créations illimitées !");
            return;
        }

        createScrimModal.style.display = 'flex';
    });

    closeScrimModalButton.addEventListener('click', () => createScrimModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target == createScrimModal) createScrimModal.style.display = 'none';
    });

    createScrimForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newScrim = {
            id: Date.now(),
            creator: loggedInUsername,
            eventDate: document.getElementById('scrim-date').value,
            roomName: document.getElementById('scrim-name').value,
            gameId: document.getElementById('scrim-game-id').value,
            avgRank: document.getElementById('scrim-rank').value,
            startTime: document.getElementById('scrim-start-time').value,
            players: [loggedInUsername]
        };
        const scrims = JSON.parse(localStorage.getItem('scrimsList')) || [];
        scrims.push(newScrim);
        localStorage.setItem('scrimsList', JSON.stringify(scrims));

        let userStats = JSON.parse(localStorage.getItem('userStats'));
        if (!userStats[loggedInUsername].isPremium) {
            userStats[loggedInUsername].dailyScrims++;
        }
        localStorage.setItem('userStats', JSON.stringify(userStats));

        createScrimForm.reset();
        createScrimModal.style.display = 'none';
        renderScrims();
    });

    scrimsListContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.classList.contains('edit-id-button')) {
            const container = target.closest('.game-id-container');
            const scrimId = container.dataset.scrimId;
            const scrims = JSON.parse(localStorage.getItem('scrimsList')) || [];
            const scrim = scrims.find(s => s.id == scrimId);
            
            container.innerHTML = `
                <input type="text" class="edit-id-input" value="${scrim.gameId || ''}" placeholder="ID de la partie">
                <button class="save-id-button" data-scrim-id="${scrimId}"><img src="images/confirme.png" alt="Confirmer"></button>
            `;
            container.querySelector('.edit-id-input').focus();
            return;
        }

        if (target.classList.contains('save-id-button')) {
            const scrimId = target.dataset.scrimId;
            const input = target.parentElement.querySelector('.edit-id-input');
            const newId = input.value.trim();

            let scrims = JSON.parse(localStorage.getItem('scrimsList')) || [];
            const scrimIndex = scrims.findIndex(s => s.id == scrimId);
            
            if (scrimIndex !== -1) {
                scrims[scrimIndex].gameId = newId;
                localStorage.setItem('scrimsList', JSON.stringify(scrims));
                renderScrims();
            }
            return;
        }

        const scrimId = target.dataset.scrimId;
        if (!scrimId) return;

        let scrims = JSON.parse(localStorage.getItem('scrimsList'));
        const scrimIndex = scrims.findIndex(s => s.id == scrimId);
        if (scrimIndex === -1) return;

        const scrim = scrims[scrimIndex];

        if (target.classList.contains('join-button')) {
            const scrimsJoined = scrims.filter(s => s.players.includes(loggedInUsername)).length;
            if (scrimsJoined >= 2) {
                alert("Vous avez déjà rejoint le nombre maximum de 2 scrims.");
                return;
            }

            if (scrim.players.length < 6 && !scrim.players.includes(loggedInUsername)) {
                scrim.players.push(loggedInUsername);
            }
        } else if (target.classList.contains('leave-button')) {
            if (loggedInUsername === scrim.creator) {
                scrims.splice(scrimIndex, 1);
            } else {
                scrim.players = scrim.players.filter(p => p !== loggedInUsername);
            }
        }

        localStorage.setItem('scrimsList', JSON.stringify(scrims));
        renderScrims();
    });
    
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
});