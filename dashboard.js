document.addEventListener('DOMContentLoaded', () => {
    // Vérifie si un utilisateur est connecté, sinon redirige vers la page d'accueil
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    // --- CONFIGURATION & DONNÉES GLOBALES ---
    const API_URL = 'https://brawlarena-gg.onrender.com';
    let isCurrentUserPremium = localStorage.getItem('isPremium') === 'true';
    let userDailyStats = JSON.parse(localStorage.getItem('userDailyStats')) || { dailyScrims: 0 };
    // NOUVEAU : Récupération des données de personnalisation
    let userCustomization = JSON.parse(localStorage.getItem('userCustomization')) || {
        activeColor: 'default',
        activeBadge: 'none',
        unlockedColors: ['default'],
        unlockedBadges: ['none']
    };

    // NOUVEAU : Mappages pour la personnalisation
    const colorClassMap = {
        'default': 'username-color-default',
        'premium-gradient': 'username-color-premium-gradient',
        'supporter-gold': 'username-color-supporter-gold'
    };

    const badgeImageMap = {
        'none': null,
        'premium': 'images/Certif.png'
    };


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
        about: document.getElementById('about-section'),
        admin: document.getElementById('admin-section')
    };

    const links = {
        profile: document.getElementById('profile-link'),
        tournaments: document.getElementById('tournaments-link'),
        scrims: document.getElementById('scrims-link'),
        settings: document.getElementById('settings-link'),
        about: document.getElementById('about-link'),
        admin: document.getElementById('admin-link')
    };
    
    // Éléments des Scrims
    const scrimsListContainer = document.getElementById('scrims-list-container');
    const showScrimModalButton = document.getElementById('show-scrim-modal-button');
    const createScrimModal = document.getElementById('create-scrim-modal');
    const closeScrimModalButton = createScrimModal.querySelector('.modal-close-button');
    const createScrimForm = document.getElementById('create-scrim-form');
    
    // Éléments du Profil et de la Personnalisation
    const profileUsernamePlaceholder = document.getElementById('profile-username-placeholder');
    const profileUserDisplay = document.getElementById('profile-user-display');
    const profilePlayerId = document.getElementById('profile-player-id');
    const profileDailyScrims = document.getElementById('profile-daily-scrims');
    const colorSelectionGrid = document.getElementById('color-selection-grid');
    const badgeSelectionGrid = document.getElementById('badge-selection-grid');
    const saveCustomizationButton = document.getElementById('save-customization-button');
    const customizationMessage = document.getElementById('customization-message');

    const playerIdForm = document.getElementById('supercell-id-form');
    const playerIdInput = document.getElementById('player-id-input');
    const settingsMessage = document.getElementById('settings-message');

    const showUsersButton = document.getElementById('show-users-button');
    const usersListContainer = document.getElementById('users-list-container');

    const premiumPromptModal = document.getElementById('premium-prompt-modal');
    const closePremiumPromptButton = premiumPromptModal.querySelector('.modal-close-button');
    const cancelPremiumPromptButton = premiumPromptModal.querySelector('.secondary-button');

    const adminLinkLi = document.getElementById('admin-link-li');
    const adminUserListContainer = document.getElementById('admin-user-list-container');
    const adminUserSearch = document.getElementById('admin-user-search');

    // --- FONCTIONS ---

    /**
     * Met à jour les comptes à rebours sur la page.
     */
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

    /**
     * Affiche les scrims en récupérant les données du serveur.
     * Met à jour l'affichage des joueurs avec leurs badges et couleurs.
     */
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
                const userStatuses = await statusesResponse.json();

                scrimsListContainer.innerHTML = '';
                scrims.forEach(scrim => {
                    const card = document.createElement('div');
                    card.className = 'scrim-card';

                    let adminDeleteIcon = '';
                    if (loggedInUsername.toLowerCase() === 'brawlarena.gg') {
                        adminDeleteIcon = `<span class="admin-delete-scrim" data-scrim-id="${scrim._id}" title="Supprimer le scrim">🗑️</span>`;
                    }

                    // Logique d'affichage des joueurs MISE À JOUR
                    const playersHTML = scrim.players.map(player => {
                        const status = userStatuses[player] || { activeColor: 'default', activeBadge: 'none' };
                        const colorClass = colorClassMap[status.activeColor] || 'username-color-default';
                        const badgeSrc = badgeImageMap[status.activeBadge];
                        const isPlayerCreator = player === scrim.creator;

                        let badgeHTML = '';
                        if (badgeSrc) {
                            badgeHTML = `<img src="${badgeSrc}" alt="Badge" class="player-badge">`;
                        }
                        
                        let creatorIconHTML = '';
                        if (isPlayerCreator) {
                            creatorIconHTML = `<img src="images/crown.png" alt="Créateur" class="creator-crown">`;
                        }

                        return `<li>${badgeHTML}<span class="${colorClass}">${player}</span> ${creatorIconHTML}</li>`;
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
                        <h3>${scrim.roomName}</h3>
                        ${gameIdHTML}
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

    /**
     * NOUVEAU : Met à jour l'affichage de l'utilisateur (navbar et profil).
     * @param {string} username - Le nom d'utilisateur.
     * @param {object} customization - L'objet de personnalisation.
     */
    function updateUserDisplay(username, customization) {
        // Mise à jour de la barre de navigation
        displayUsernameInNavbar.textContent = username;
        displayUsernameInNavbar.className = 'username-text'; // Reset classes
        displayUsernameInNavbar.classList.add(colorClassMap[customization.activeColor] || 'username-color-default');
        
        navbarPremiumBadge.innerHTML = '';
        const badgeSrc = badgeImageMap[customization.activeBadge];
        if (badgeSrc) {
            navbarPremiumBadge.innerHTML = `<img src="${badgeSrc}" alt="Badge Premium" class="premium-badge">`;
        }
    }

    /**
     * Met à jour les informations du profil.
     */
    function updateProfileView() {
        const today = new Date().toISOString().split('T')[0];
        if (userDailyStats.lastActivityDate !== today) {
            userDailyStats.dailyScrims = 0;
            userDailyStats.lastActivityDate = today;
            localStorage.setItem('userDailyStats', JSON.stringify(userDailyStats));
        }

        profileUsernamePlaceholder.textContent = loggedInUsername;
        profileDailyScrims.textContent = isCurrentUserPremium ? 'Illimité ✨' : `${Math.max(0, 2 - userDailyStats.dailyScrims)} / 2`;
        
        // Mise à jour de l'aperçu du pseudo/badge dans la section profil
        profileUserDisplay.innerHTML = '';
        const badgeSrc = badgeImageMap[userCustomization.activeBadge];
        if (badgeSrc) {
            profileUserDisplay.innerHTML += `<img src="${badgeSrc}" alt="Badge" class="player-badge">`;
        }
        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = loggedInUsername;
        usernameSpan.className = `username-text-display ${colorClassMap[userCustomization.activeColor] || 'username-color-default'}`;
        profileUserDisplay.appendChild(usernameSpan);
    }
    
    /**
     * NOUVEAU : Construit et affiche les options de personnalisation.
     */
    function renderProfileCustomization() {
        colorSelectionGrid.innerHTML = '';
        badgeSelectionGrid.innerHTML = '';

        // Création des options de couleurs
        userCustomization.unlockedColors.forEach(colorId => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.colorId = colorId;
            
            const innerSpan = document.createElement('span');
            innerSpan.textContent = 'Aa';
            innerSpan.className = colorClassMap[colorId] || 'username-color-default';
            swatch.appendChild(innerSpan);

            if (colorId === userCustomization.activeColor) {
                swatch.classList.add('selected');
            }
            // Verrouiller l'option premium si l'utilisateur ne l'est pas
            if (colorId.includes('premium') && !isCurrentUserPremium) {
                swatch.classList.add('locked');
                swatch.title = "Réservé aux membres Premium";
            }
            colorSelectionGrid.appendChild(swatch);
        });

        // Création des options de badges
        userCustomization.unlockedBadges.forEach(badgeId => {
            if (badgeId === 'none') return; // Ne pas afficher l'option "pas de badge"
            const container = document.createElement('div');
            container.className = 'badge-icon-container';
            container.dataset.badgeId = badgeId;

            const imgSrc = badgeImageMap[badgeId];
            if (imgSrc) {
                container.innerHTML = `<img src="${imgSrc}" alt="Badge ${badgeId}">`;
            }

            if (badgeId === userCustomization.activeBadge) {
                container.classList.add('selected');
            }
            if (badgeId.includes('premium') && !isCurrentUserPremium) {
                container.classList.add('locked');
                container.title = "Réservé aux membres Premium";
            }
            badgeSelectionGrid.appendChild(container);
        });
    }

    function updateUtcClock() {
        const now = new Date();
        utcClockElement.textContent = `UTC ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;
    }

    function showSection(sectionToShow) {
        Object.values(sections).forEach(section => { if (section) section.style.display = 'none'; });
        if (sectionToShow) sectionToShow.style.display = 'block';
    }

    async function renderAdminUsers() { /* ... code inchangé ... */ }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

    // Navigation principale
    links.scrims.addEventListener('click', (e) => { e.preventDefault(); renderScrims(); showSection(sections.scrims); });
    links.settings.addEventListener('click', (e) => { e.preventDefault(); showSection(sections.settings); });
    links.tournaments.addEventListener('click', (e) => { e.preventDefault(); alert('La section Tournois est en cours de développement !'); });
    if (links.about) links.about.addEventListener('click', (e) => { e.preventDefault(); showSection(sections.about); });
    if (links.admin) links.admin.addEventListener('click', (e) => { e.preventDefault(); renderAdminUsers(); showSection(sections.admin); });

    // Clic sur le pseudo ou le lien de profil pour afficher la section profil
    const showProfileSection = (e) => {
        e.preventDefault();
        updateProfileView();
        renderProfileCustomization();
        showSection(sections.profile);
    };
    displayUsernameInNavbar.addEventListener('click', showProfileSection);
    links.profile.addEventListener('click', showProfileSection);

    // Déconnexion
    logoutButton.addEventListener('click', () => {
        if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
            localStorage.clear();
            window.location.href = 'index.html';
        }
    });

    // Toggle Premium (pour test)
    togglePremiumButton.addEventListener('click', async () => { /* ... code inchangé ... */ });
    
    // NOUVEAU : Sélection d'une option de personnalisation
    colorSelectionGrid.addEventListener('click', (e) => {
        const target = e.target.closest('.color-swatch');
        if (!target || target.classList.contains('locked')) return;
        
        colorSelectionGrid.querySelector('.selected')?.classList.remove('selected');
        target.classList.add('selected');
    });

    badgeSelectionGrid.addEventListener('click', (e) => {
        const target = e.target.closest('.badge-icon-container');
        if (!target || target.classList.contains('locked')) return;

        const currentSelected = badgeSelectionGrid.querySelector('.selected');
        if (currentSelected === target) { // Déselectionner
            currentSelected.classList.remove('selected');
        } else {
            currentSelected?.classList.remove('selected');
            target.classList.add('selected');
        }
    });

    // NOUVEAU : Sauvegarde de la personnalisation
    saveCustomizationButton.addEventListener('click', async () => {
        const selectedColorEl = colorSelectionGrid.querySelector('.selected');
        const selectedBadgeEl = badgeSelectionGrid.querySelector('.selected');

        const newColor = selectedColorEl ? selectedColorEl.dataset.colorId : userCustomization.activeColor;
        const newBadge = selectedBadgeEl ? selectedBadgeEl.dataset.badgeId : 'none';

        try {
            saveCustomizationButton.disabled = true;
            saveCustomizationButton.textContent = "Sauvegarde...";
            customizationMessage.textContent = "";

            const response = await fetch(`${API_URL}/users/customize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loggedInUsername, newColor, newBadge })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            // Mettre à jour les données locales
            userCustomization.activeColor = newColor;
            userCustomization.activeBadge = newBadge;
            localStorage.setItem('userCustomization', JSON.stringify(userCustomization));

            // Mettre à jour l'affichage
            updateUserDisplay(loggedInUsername, userCustomization);
            updateProfileView(); // Pour l'aperçu dans la page profil

            customizationMessage.textContent = data.message;
            customizationMessage.className = 'success';

        } catch (error) {
            customizationMessage.textContent = error.message;
            customizationMessage.className = 'error';
        } finally {
            saveCustomizationButton.disabled = false;
            saveCustomizationButton.textContent = "Sauvegarder les changements";
        }
    });

    // Création de scrims et autres événements existants...
    // Le reste du code (création de scrims, modales, admin, etc.) reste identique.
    // Assurez-vous de copier les sections inchangées de votre fichier original ici.
    // ... (Collez ici le reste de votre code pour `createScrimForm`, `scrimsListContainer`, `adminUserListContainer`, etc.)
    // Par exemple :
    showScrimModalButton.addEventListener('click', () => {
        updateProfileView(); // Utilise la fonction mise à jour
        if (!isCurrentUserPremium && userDailyStats.dailyScrims >= 2) {
            premiumPromptModal.style.display = 'flex';
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
    
    scrimsListContainer.addEventListener('click', async (e) => { /* ... code inchangé ... */ });
    adminUserListContainer.addEventListener('click', async (e) => { /* ... code inchangé ... */ });
    adminUserSearch.addEventListener('keyup', (event) => { /* ... code inchangé ... */ });
    closeScrimModalButton.addEventListener('click', () => { createScrimModal.style.display = 'none'; });
    closePremiumPromptButton.addEventListener('click', () => { premiumPromptModal.style.display = 'none'; });
    cancelPremiumPromptButton.addEventListener('click', () => { premiumPromptModal.style.display = 'none'; });
    window.addEventListener('click', (e) => { 
        if (e.target == createScrimModal) createScrimModal.style.display = 'none';
        if (e.target == premiumPromptModal) premiumPromptModal.style.display = 'none';
    });
    playerIdForm.addEventListener('submit', (e) => { /* ... code inchangé ... */ });


    // --- INITIALISATION DE LA PAGE ---
    usernameDisplay.textContent = loggedInUsername;
    updateUserDisplay(loggedInUsername, userCustomization); // NOUVEL APPEL
    updateProfileView();
    showSection(sections.home);

    if (loggedInUsername.toLowerCase() === 'brawlarena.gg') {
        if(adminLinkLi) adminLinkLi.style.display = 'list-item';
    }

    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    setInterval(updateAllCountdowns, 1000);
});