document.addEventListener('DOMContentLoaded', () => {
    // Vérifie si un utilisateur est connecté, sinon redirige vers la page d'accueil
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    // Configuration de l'API
    const API_URL = 'https://brawlarena-gg.onrender.com';

    // --- NOUVEL OBJET UTILISATEUR GLOBAL ---
    let currentUser = {
        username: loggedInUsername,
        isPremium: localStorage.getItem('isPremium') === 'true',
        dailyStats: JSON.parse(localStorage.getItem('userDailyStats')) || { dailyScrims: 0 },
        customization: JSON.parse(localStorage.getItem('userCustomization')) || {
            activeColor: 'default',
            activeBadge: 'none',
            unlockedColors: ['default'],
            unlockedBadges: ['none']
        }
    };

    // Variables pour suivre la sélection dans le menu de personnalisation
    let selectedColor = currentUser.customization.activeColor;
    let selectedBadge = currentUser.customization.activeBadge;


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

    const scrimsListContainer = document.getElementById('scrims-list-container');
    const showScrimModalButton = document.getElementById('show-scrim-modal-button');
    const createScrimModal = document.getElementById('create-scrim-modal');
    const closeScrimModalButton = createScrimModal.querySelector('.modal-close-button');
    const createScrimForm = document.getElementById('create-scrim-form');
    
    // Nouveaux sélecteurs pour le profil
    const profileUsernamePlaceholder = document.getElementById('profile-username-placeholder');
    const profileUserDisplay = document.getElementById('profile-user-display');
    const colorSelectionGrid = document.getElementById('color-selection-grid');
    const badgeSelectionGrid = document.getElementById('badge-selection-grid');
    const saveCustomizationButton = document.getElementById('save-customization-button');
    const customizationMessage = document.getElementById('customization-message');

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

    const premiumPromptModal = document.getElementById('premium-prompt-modal');
    const closePremiumPromptButton = premiumPromptModal.querySelector('.modal-close-button');
    const cancelPremiumPromptButton = premiumPromptModal.querySelector('.secondary-button');

    const adminLinkLi = document.getElementById('admin-link-li');
    const adminUserListContainer = document.getElementById('admin-user-list-container');
    const adminUserSearch = document.getElementById('admin-user-search');

    // --- FONCTIONS ---

    // NOUVELLE FONCTION UNIVERSELLE POUR AFFICHER UN UTILISATEUR
    function renderUserDisplay(username, customization, options = {}) {
        const badgeMap = {
            'none': '', // Pas d'image pour "aucun"
            'premium': 'images/Certif.png',
            'creator': 'images/crown.png'
        };

        let badgeToRender = customization.activeBadge;
        // Option pour forcer un badge (ex: couronne du créateur)
        if (options.overrideBadge) {
            badgeToRender = options.overrideBadge;
        }

        const badgeUrl = badgeMap[badgeToRender] || '';
        
        const badgeHTML = badgeUrl 
            ? `<img src="${badgeUrl}" alt="Badge" class="player-badge badge-${badgeToRender}">`
            : '<span class="player-badge badge-none"></span>';

        const usernameHTML = `<span class="username-text-display username-color-${customization.activeColor}">${username}</span>`;
        
        return `${badgeHTML}${usernameHTML}`;
    }
    
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
                const userStatusMap = await statusesResponse.json();
                scrimsListContainer.innerHTML = '';
                scrims.forEach(scrim => {
                    const card = document.createElement('div');
                    card.className = 'scrim-card';
                    let adminDeleteIcon = '';
                    if (currentUser.username.toLowerCase() === 'brawlarena.gg') {
                        adminDeleteIcon = `<span class="admin-delete-scrim" data-scrim-id="${scrim._id}" title="Supprimer le scrim">🗑️</span>`;
                    }
                    // LOGIQUE D'AFFICHAGE DES JOUEURS AMÉLIORÉE
                    const playersHTML = scrim.players.map(player => {
                        const playerData = userStatusMap[player] || { activeColor: 'default', activeBadge: 'none' };
                        const isCreator = player === scrim.creator;
                        
                        const playerDisplayHTML = renderUserDisplay(player, playerData, { 
                            overrideBadge: isCreator ? 'creator' : null 
                        });
                        
                        return `<li>${playerDisplayHTML}</li>`;
                    }).join('');

                    const isUserInScrim = scrim.players.includes(currentUser.username);
                    const isCreator = currentUser.username === scrim.creator;
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

    // FONCTION DE MISE À JOUR GLOBALE DE L'AFFICHAGE UTILISATEUR
    function updateGlobalUserDisplay() {
        const userDisplayHTML = renderUserDisplay(currentUser.username, currentUser.customization);
        
        // Navbar
        displayUsernameInNavbar.innerHTML = userDisplayHTML;
        navbarPremiumBadge.style.display = 'none'; // On n'utilise plus l'ancien badge séparé

        // Page Profil (si elle est affichée)
        if (sections.profile.style.display === 'block') {
            profileUsernamePlaceholder.textContent = currentUser.username;
            profileUserDisplay.innerHTML = renderUserDisplay(currentUser.username, currentUser.customization);
        }
    }
    
    // Met à jour les statistiques sur la page de profil
    function updateProfileStats() {
        const today = new Date().toISOString().split('T')[0];
        if (currentUser.dailyStats.lastActivityDate !== today) {
            currentUser.dailyStats.dailyScrims = 0;
        }
        profileDailyTournaments.textContent = 'N/A';
        profileDailyScrims.textContent = currentUser.isPremium ? 'Illimité ✨' : Math.max(0, 2 - currentUser.dailyStats.dailyScrims);
    }
    
    // NOUVELLE FONCTION POUR AFFICHER LES OPTIONS DE PERSONNALISATION
    function renderProfileCustomization() {
        // --- RENDU DES COULEURS ---
        colorSelectionGrid.innerHTML = '';
        const availableColors = {
            'default': 'var(--text-light)',
            'premium-gradient': 'linear-gradient(90deg, var(--primary-blue), var(--accent-violet))',
            // 'supporter-gold': '#FFD700' // Exemple de future couleur
        };

        currentUser.customization.unlockedColors.forEach(colorId => {
            if (colorId === 'premium-gradient' && !currentUser.isPremium) return; // Ne pas afficher si non premium

            const colorValue = availableColors[colorId];
            if (!colorValue) return; // Sécurité si une couleur n'est pas définie
            
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.colorId = colorId;
            swatch.style.background = colorValue;
            if (selectedColor === colorId) {
                swatch.classList.add('selected');
            }
            swatch.addEventListener('click', () => {
                selectedColor = colorId;
                renderProfileCustomization(); // Re-render pour mettre à jour la sélection
            });
            colorSelectionGrid.appendChild(swatch);
        });

        // --- RENDU DES BADGES ---
        badgeSelectionGrid.innerHTML = '';
        const availableBadges = {
            'none': 'images/cancel.png', // Mettre une icône "croix" ou "aucun"
            'premium': 'images/Certif.png'
        };
        
        currentUser.customization.unlockedBadges.forEach(badgeId => {
            if (badgeId === 'premium' && !currentUser.isPremium) return;
            
            const badgeUrl = availableBadges[badgeId];
            if (!badgeUrl) return;

            const badgeContainer = document.createElement('div');
            badgeContainer.className = 'badge-icon-container';
            badgeContainer.dataset.badgeId = badgeId;
            
            const img = document.createElement('img');
            img.src = badgeUrl;
            img.alt = `Badge ${badgeId}`;
            badgeContainer.appendChild(img);

            if (selectedBadge === badgeId) {
                badgeContainer.classList.add('selected');
            }
            badgeContainer.addEventListener('click', () => {
                selectedBadge = badgeId;
                renderProfileCustomization();
            });
            badgeSelectionGrid.appendChild(badgeContainer);
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

    async function renderAdminUsers() {
        // ... (fonction inchangée)
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

    displayUsernameInNavbar.addEventListener('click', (e) => {
        e.preventDefault();
        links.profile.click(); // Simule un clic sur le lien du profil
    });
    
    links.profile.addEventListener('click', (e) => {
        e.preventDefault();
        // Réinitialiser la sélection à ce qui est actuellement sauvegardé
        selectedColor = currentUser.customization.activeColor;
        selectedBadge = currentUser.customization.activeBadge;
        
        updateGlobalUserDisplay(); // Met à jour l'affichage principal du profil
        updateProfileStats(); // Met à jour les stats
        renderProfileCustomization(); // Affiche les options de personnalisation
        showSection(sections.profile);
    });

    saveCustomizationButton.addEventListener('click', async () => {
        saveCustomizationButton.disabled = true;
        saveCustomizationButton.textContent = "Sauvegarde...";
        customizationMessage.textContent = "";

        try {
            const response = await fetch(`${API_URL}/users/customize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    newColor: selectedColor,
                    newBadge: selectedBadge
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");

            // Mettre à jour les données locales et le localStorage
            currentUser.customization.activeColor = selectedColor;
            currentUser.customization.activeBadge = selectedBadge;
            localStorage.setItem('userCustomization', JSON.stringify(currentUser.customization));

            customizationMessage.textContent = data.message;
            customizationMessage.className = 'success';

            updateGlobalUserDisplay(); // Mettre à jour l'affichage partout

        } catch (error) {
            customizationMessage.textContent = error.message;
            customizationMessage.className = 'error';
        } finally {
            saveCustomizationButton.disabled = false;
            saveCustomizationButton.textContent = "Sauvegarder les changements";
        }
    });

    logoutButton.addEventListener('click', () => {
        if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
            localStorage.removeItem('loggedInUsername');
            localStorage.removeItem('isPremium');
            localStorage.removeItem('userDailyStats');
            localStorage.removeItem('userCustomization'); // Ne pas oublier de supprimer
            window.location.href = 'index.html';
        }
    });

    togglePremiumButton.addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_URL}/premium/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            
            // Mise à jour de l'état local
            currentUser.isPremium = data.isPremium;
            localStorage.setItem('isPremium', currentUser.isPremium);

            updateGlobalUserDisplay();
            updateProfileStats();
            if (sections.scrims.style.display === 'block') await renderScrims();
            alert(`Statut Premium ${currentUser.isPremium ? 'activé' : 'désactivé'} !`);
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    });

    showUsersButton.addEventListener('click', async () => {
        // ... (fonction inchangée)
    });

    showScrimModalButton.addEventListener('click', () => {
        updateProfileStats();
        
        if (!currentUser.isPremium && currentUser.dailyStats.dailyScrims >= 2) {
            premiumPromptModal.style.display = 'flex';
            return;
        }
        createScrimModal.style.display = 'flex';
    });

    createScrimForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... (début de la fonction)
        const scrimData = {
            creator: currentUser.username,
            // ... (reste des données)
        };
        try {
            // ... (logique d'envoi)
            if (!currentUser.isPremium) {
                currentUser.dailyStats.dailyScrims++;
                currentUser.dailyStats.lastActivityDate = new Date().toISOString().split('T')[0];
                localStorage.setItem('userDailyStats', JSON.stringify(currentUser.dailyStats));
            }
            // ... (reste de la fonction)
        } catch (error) {
            // ...
        } finally {
            // ...
        }
    });

    scrimsListContainer.addEventListener('click', async (e) => {
        // ... (logique des clics sur join/leave/delete/edit, inchangée)
    });

    adminUserListContainer.addEventListener('click', async (e) => {
        // ... (logique inchangée)
    });

    adminUserSearch.addEventListener('keyup', (event) => {
        // ... (logique inchangée)
    });

    // --- NAVIGATION ---
    links.scrims.addEventListener('click', async (e) => { e.preventDefault(); await renderScrims(); showSection(sections.scrims); });
    links.settings.addEventListener('click', (e) => { e.preventDefault(); showSection(sections.settings); });
    links.tournaments.addEventListener('click', (e) => { e.preventDefault(); alert('La section Tournois est en cours de développement !'); });
    if (links.about) {
        links.about.addEventListener('click', (e) => { e.preventDefault(); showSection(sections.about); });
    }
    if (links.admin) {
        links.admin.addEventListener('click', (e) => { e.preventDefault(); renderAdminUsers(); showSection(sections.admin); });
    }
    
    // --- MODALES ---
    // ... (logique inchangée)
    
    // --- PARAMÈTRES ---
    // ... (logique inchangée)

    // --- INITIALISATION DE LA PAGE ---
    usernameDisplay.textContent = currentUser.username; // Fallback
    updateGlobalUserDisplay(); // Nouvelle fonction principale
    updateProfileStats();
    showSection(sections.home);

    if (currentUser.username.toLowerCase() === 'brawlarena.gg') {
        if(adminLinkLi) adminLinkLi.style.display = 'list-item';
    }

    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    setInterval(updateAllCountdowns, 1000);
});