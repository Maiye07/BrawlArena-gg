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
    let userDailyStats = JSON.parse(localStorage.getItem('userDailyStats')) || { dailyScrims: 0, lastActivityDate: new Date().toISOString().split('T')[0], dailyTournaments: 0, lastTournamentDate: null };
    let userCustomization = JSON.parse(localStorage.getItem('userCustomization')) || {
        activeColor: 'default',
        activeBadge: 'none',
        unlockedColors: ['default'],
        unlockedBadges: ['none']
    };
    let allUsersData = []; // Pour stocker les données des utilisateurs pour l'admin

    const colorClassMap = {
        'default': 'username-color-default',
        'premium-gradient': 'username-color-premium-gradient',
        'supporter-gold': 'username-color-supporter-gold',
        'moderator-gradient': 'username-color-moderator-gradient'
    };
    const badgeImageMap = {
        'none': null,
        'premium': 'images/Certif.png',
        'supporter-gold': 'images/supporter.png',
        'moderator': 'images/moderator.png'
    };

    // --- SÉLECTION DES ÉLÉMENTS DU DOM ---
    const usernameDisplay = document.getElementById('username-display');
    const utcClockElement = document.getElementById('utc-clock');
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
    
    const profileUsernamePlaceholder = document.getElementById('profile-username-placeholder');
    const profileUserDisplay = document.getElementById('profile-user-display');
    const profileDailyScrims = document.getElementById('profile-daily-scrims');
    
    const colorSelectionGrid = document.getElementById('color-selection-grid');
    const badgeSelectionGrid = document.getElementById('badge-selection-grid');
    const saveCustomizationButton = document.getElementById('save-customization-button');
    const customizationMessage = document.getElementById('customization-message');
    
    const premiumPromptModal = document.getElementById('premium-prompt-modal');
    const closePremiumPromptButton = premiumPromptModal.querySelector('.modal-close-button');
    const cancelPremiumPromptButton = premiumPromptModal.querySelector('.secondary-button');
    
    const playerIdForm = document.getElementById('supercell-id-form');
    const playerIdInput = document.getElementById('player-id-input');
    const settingsMessage = document.getElementById('settings-message');

    // --- Éléments Admin ---
    const adminLinkLi = document.getElementById('admin-link-li');
    const adminUserListContainer = document.getElementById('admin-user-list-container');
    const adminUserSearch = document.getElementById('admin-user-search');
    const adminCustomizationModal = document.getElementById('admin-manage-customization-modal');
    const adminBanModal = document.getElementById('admin-ban-modal');
    const banModalUsername = document.getElementById('ban-modal-username');
    const banningUsernameHidden = document.getElementById('banning-username-hidden');
    const banDurationContainer = document.getElementById('ban-duration-container');
    const banTypeTempRadio = document.getElementById('ban-type-temp');
    const banTypePermRadio = document.getElementById('ban-type-perm');
    const banDurationInput = document.getElementById('ban-duration-days');
    const confirmBanButton = document.getElementById('admin-confirm-ban-button');


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
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            element.textContent = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        });
    }

    async function renderScrims() {
        try {
            const scrimsResponse = await fetch(`${API_URL}/scrims`);
            if (!scrimsResponse.ok) throw new Error('Échec de la récupération des scrims.');
            const scrims = await scrimsResponse.json();
            
            if (scrims.length > 0) {
                const allUsernames = new Set(scrims.flatMap(scrim => scrim.players));
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
                    
                    const playersHTML = scrim.players.map(player => {
                        const status = userStatuses[player] || { activeColor: 'default', activeBadge: 'none' };
                        const colorClass = colorClassMap[status.activeColor] || 'username-color-default';
                        const badgeSrc = badgeImageMap[status.activeBadge];
                        
                        let badgeHTML = badgeSrc ? `<img src="${badgeSrc}" alt="Badge" class="player-badge">` : '';
                        let creatorIconHTML = (player === scrim.creator) ? `<img src="images/crown.png" alt="Créateur" class="creator-crown">` : '';

                        return `<li><span class="${colorClass}">${player}</span>${badgeHTML} ${creatorIconHTML}</li>`;
                    }).join('');

                    let adminDeleteIcon = (loggedInUsername.toLowerCase() === 'brawlarena.gg') ? `<span class="admin-delete-scrim" data-scrim-id="${scrim._id}" title="Supprimer">🗑️</span>` : '';
                    const isUserInScrim = scrim.players.includes(loggedInUsername);
                    const isFull = scrim.players.length >= 6;
                    const actionButtonHTML = isUserInScrim
                        ? `<button class="button leave-button" data-scrim-id="${scrim._id}">Quitter</button>`
                        : (!isFull ? `<button class="button join-button" data-scrim-id="${scrim._id}">Rejoindre</button>` : `<button class="button" disabled>Plein</button>`);
                    
                    let gameIdHTML = `<p><strong>ID Partie :</strong> Rejoignez pour voir</p>`;
                    if (isUserInScrim) {
                        const gameIdText = scrim.gameId || 'Non défini';
                        gameIdHTML = (scrim.creator === loggedInUsername)
                            ? `<p><strong>ID Partie :</strong> <span class="game-id-container" data-scrim-id="${scrim._id}"><span class="game-id-text">${gameIdText}</span><button class="edit-id-button"><img src="images/edit.png" alt="Modifier"></button></span></p>`
                            : `<p><strong>ID Partie :</strong> ${gameIdText}</p>`;
                    }

                    card.innerHTML = `
                        ${adminDeleteIcon}
                        <h3>${scrim.roomName}</h3>
                        ${gameIdHTML}
                        <p><strong>Rang Moyen :</strong> ${scrim.avgRank}</p>
                        <p><strong>Commence dans :</strong> <span class="countdown-timer" data-start-time="${scrim.startTime}">Calcul...</span></p>
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
    
    function updateUserDisplay(username, customization) {
        displayUsernameInNavbar.textContent = username;
        displayUsernameInNavbar.className = 'username-text';
        displayUsernameInNavbar.classList.add(colorClassMap[customization.activeColor] || 'username-color-default');
        
        const badgeSrc = badgeImageMap[customization.activeBadge];
        navbarPremiumBadge.innerHTML = badgeSrc ? `<img src="${badgeSrc}" alt="Badge" class="premium-badge">` : '';
    }

    function updateProfileView() {
        const today = new Date().toISOString().split('T')[0];
        if (userDailyStats.lastActivityDate !== today) {
            userDailyStats.dailyScrims = 0;
            userDailyStats.lastActivityDate = today;
            localStorage.setItem('userDailyStats', JSON.stringify(userDailyStats));
        }

        if (profileUsernamePlaceholder) profileUsernamePlaceholder.textContent = loggedInUsername;
        if (profileDailyScrims) profileDailyScrims.textContent = isCurrentUserPremium ? 'Illimité ✨' : `${Math.max(0, 2 - userDailyStats.dailyScrims)}`;
        
        if (profileUserDisplay) {
            const badgeSrc = badgeImageMap[userCustomization.activeBadge];
            const colorClass = colorClassMap[userCustomization.activeColor] || 'username-color-default';
            profileUserDisplay.innerHTML = `
                <span class="username-text-display ${colorClass}">${loggedInUsername}</span>
                ${badgeSrc ? `<img src="${badgeSrc}" alt="Badge" class="player-badge">` : ''}
            `;
        }
    }
    
    function renderProfileCustomization() {
        if (!colorSelectionGrid || !badgeSelectionGrid) return;

        const colorCountDisplaySpan = document.getElementById('color-count-display');
        const badgeCountDisplaySpan = document.getElementById('badge-count-display');

        colorSelectionGrid.innerHTML = '';
        badgeSelectionGrid.innerHTML = '';

        const userUnlockedColors = userCustomization.unlockedColors || [];
        const userUnlockedBadges = userCustomization.unlockedBadges || [];

        const totalColors = Object.keys(colorClassMap).length;
        const unlockedColorsCount = userUnlockedColors.length;
        if (colorCountDisplaySpan) {
            colorCountDisplaySpan.textContent = `(${unlockedColorsCount}/${totalColors})`;
        }

        Object.keys(colorClassMap).forEach(colorId => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.colorId = colorId;
            swatch.innerHTML = `<span class="${colorClassMap[colorId] || ''}">Aa</span>`;

            const isUnlocked = userUnlockedColors.includes(colorId);

            if (isUnlocked) {
                if (colorId === userCustomization.activeColor) {
                    swatch.classList.add('selected');
                }
            } else {
                swatch.classList.add('locked');
                swatch.title = "Non débloqué";
            }
            colorSelectionGrid.appendChild(swatch);
        });

        const totalBadges = Object.keys(badgeImageMap).length - 1; 
        const unlockedBadgesCount = userUnlockedBadges.length - (userUnlockedBadges.includes('none') ? 1 : 0);
        if (badgeCountDisplaySpan) {
            badgeCountDisplaySpan.textContent = `(${unlockedBadgesCount}/${totalBadges})`;
        }

        Object.keys(badgeImageMap).forEach(badgeId => {
            const badgeSrc = badgeImageMap[badgeId];
            if (!badgeSrc && badgeId !== 'none') return; 

            if (badgeId === 'none') return; // Do not render the 'none' badge selector visually

            const container = document.createElement('div');
            container.className = 'badge-icon-container';
            container.dataset.badgeId = badgeId;
            container.innerHTML = `<img src="${badgeSrc}" alt="Badge ${badgeId}">`;

            const isUnlocked = userUnlockedBadges.includes(badgeId);

            if (isUnlocked) {
                if (badgeId === userCustomization.activeBadge) {
                    container.classList.add('selected');
                }
            } else {
                container.classList.add('locked');
                container.title = "Non débloqué";
            }
            badgeSelectionGrid.appendChild(container);
        });
    }
    
    function updateUtcClock() {
        const now = new Date();
        utcClockElement.textContent = `UTC ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    }

    function showSection(sectionId) {
        Object.values(sections).forEach(section => {
            if (section) section.style.display = 'none';
        });
        if (sections[sectionId]) {
            sections[sectionId].style.display = 'block';
        }
    }
    
    // --- LOGIQUE DE L'ADMINISTRATION (RÉNOVÉE) ---

    async function renderAdminUsers(filter = '') {
        adminUserListContainer.innerHTML = `<p>Chargement...</p>`;
        try {
            const response = await fetch(`${API_URL}/admin/users?requestingUser=${loggedInUsername}`);
            if (!response.ok) throw new Error((await response.json()).error || 'Erreur de chargement.');
            
            allUsersData = await response.json(); // Stocke les données
            
            const filteredUsers = allUsersData.filter(user => 
                user.username.toLowerCase().includes(filter.toLowerCase()) && 
                user.username.toLowerCase() !== 'brawlarena.gg'
            );

            let usersHTML = filteredUsers.map(user => {
                let statusHTML, banActions;

                if (user.isBannedPermanently) {
                    statusHTML = '<span class="status-banned">Banni Permanent</span>';
                    banActions = `<button class="button unban-btn" data-username="${user.username}">Débannir</button>`;
                } else if (user.banExpiresAt && new Date(user.banExpiresAt) > new Date()) {
                    statusHTML = `<span class="status-banned">Banni (jusqu'au ${new Date(user.banExpiresAt).toLocaleDateString('fr-FR')})</span>`;
                    banActions = `<button class="button unban-btn" data-username="${user.username}">Débannir</button>`;
                } else {
                    statusHTML = '<span class="status-ok">Actif</span>';
                    banActions = `<button class="button ban-user-btn" data-username="${user.username}">Ban</button>`;
                }
                
                return `<div class="admin-user-row">
                          <span class="admin-user-info"><strong>${user.username}</strong> ${user.isPremium ? '<span>- 👑 Premium</span>' : ''}</span>
                          <span class="admin-user-status">${statusHTML}</span>
                          <span class="admin-user-actions">
                            <button class="button manage-cosmetics-btn" data-username="${user.username}">Gérer</button>
                            ${banActions}
                          </span>
                        </div>`;
            }).join('');
            
            adminUserListContainer.innerHTML = `<div class="admin-user-table">${usersHTML || '<p>Aucun utilisateur trouvé.</p>'}</div>`;
        } catch (error) {
            adminUserListContainer.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    // Ouvre la modale de gestion des cosmétiques
    function openCustomizationModal(username) {
        const user = allUsersData.find(u => u.username === username);
        if (!user) {
            alert("Utilisateur non trouvé !");
            return;
        }

        document.getElementById('customization-modal-username').textContent = user.username;
        document.getElementById('editing-username-hidden').value = user.username;
        
        const colorsContainer = document.getElementById('admin-colors-list');
        const badgesContainer = document.getElementById('admin-badges-list');
        
        colorsContainer.innerHTML = '';
        badgesContainer.innerHTML = '';

        // Peupler les couleurs
        Object.keys(colorClassMap).forEach(colorId => {
            const isUnlocked = user.unlockedColors.includes(colorId);
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            label.innerHTML = `<input type="checkbox" value="${colorId}" ${isUnlocked ? 'checked' : ''}> <span class="${colorClassMap[colorId]}">${colorId}</span>`;
            colorsContainer.appendChild(label);
        });
        
        // Peupler les badges
        Object.keys(badgeImageMap).forEach(badgeId => {
            if (badgeId === 'none') return; // Le badge 'none' est implicite
            const isUnlocked = user.unlockedBadges.includes(badgeId);
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            label.innerHTML = `<input type="checkbox" value="${badgeId}" ${isUnlocked ? 'checked' : ''}> <img src="${badgeImageMap[badgeId]}" style="width:20px; height:20px; vertical-align:middle; margin-right: 5px;"> ${badgeId}`;
            badgesContainer.appendChild(label);
        });

        adminCustomizationModal.style.display = 'flex';
    }


    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

    // Navigation
    links.scrims.addEventListener('click', (e) => { e.preventDefault(); renderScrims(); showSection('scrims'); });
    links.settings.addEventListener('click', (e) => { e.preventDefault(); showSection('settings'); });
    links.about.addEventListener('click', (e) => { e.preventDefault(); showSection('about'); });
    if (links.admin) {
        links.admin.addEventListener('click', (e) => { e.preventDefault(); renderAdminUsers(); showSection('admin'); });
    }

    const showProfile = (e) => {
        e.preventDefault();
        updateProfileView();
        renderProfileCustomization();
        showSection('profile');
    };
    displayUsernameInNavbar.addEventListener('click', showProfile);
    links.profile.addEventListener('click', showProfile);

    // Déconnexion
    logoutButton.addEventListener('click', () => {
        if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
            localStorage.clear();
            window.location.href = 'index.html';
        }
    });
    
    // Bouton de test premium
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
            
            if (isCurrentUserPremium) {
                // Débloque les objets premium côté client pour une MàJ instantanée
                const unlockedColors = new Set(userCustomization.unlockedColors);
                ['premium-gradient', 'supporter-gold'].forEach(color => unlockedColors.add(color));
                userCustomization.unlockedColors = Array.from(unlockedColors);

                const unlockedBadges = new Set(userCustomization.unlockedBadges);
                ['premium', 'supporter-gold'].forEach(badge => unlockedBadges.add(badge));
                userCustomization.unlockedBadges = Array.from(unlockedBadges);
                
                localStorage.setItem('userCustomization', JSON.stringify(userCustomization));
            }

            // Rafraîchir toute l'interface
            updateUserDisplay(loggedInUsername, userCustomization);
            updateProfileView();
            renderProfileCustomization(); // Essentiel pour mettre à jour les grilles

            alert(`Statut Premium ${isCurrentUserPremium ? 'activé' : 'désactivé'} !`);

        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    });
    
    // Personnalisation
    if (saveCustomizationButton) {
        saveCustomizationButton.addEventListener('click', async () => {
            const newColor = colorSelectionGrid.querySelector('.selected')?.dataset.colorId || userCustomization.activeColor;
            const selectedBadgeEl = badgeSelectionGrid.querySelector('.selected');
            const newBadge = selectedBadgeEl ? selectedBadgeEl.dataset.badgeId : 'none';

            try {
                saveCustomizationButton.disabled = true;
                saveCustomizationButton.textContent = "Sauvegarde...";
                
                const response = await fetch(`${API_URL}/users/customize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        username: loggedInUsername, 
                        newColor: newColor, 
                        newBadge: newBadge 
                    })
                });
                
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Une erreur inconnue est survenue.");
                }
                
                userCustomization.activeColor = newColor;
                userCustomization.activeBadge = newBadge;
                localStorage.setItem('userCustomization', JSON.stringify(userCustomization));

                updateUserDisplay(loggedInUsername, userCustomization);
                updateProfileView();
                
                customizationMessage.textContent = data.message;
                customizationMessage.className = 'success';
            } catch (error) {
                customizationMessage.textContent = `Erreur : ${error.message}`;
                customizationMessage.className = 'error';
            } finally {
                saveCustomizationButton.disabled = false;
                saveCustomizationButton.textContent = "Sauvegarder les changements";
            }
        });
    }
    
    if (colorSelectionGrid) colorSelectionGrid.addEventListener('click', (e) => {
        const target = e.target.closest('.color-swatch');
        if (target && !target.classList.contains('locked')) {
            colorSelectionGrid.querySelector('.selected')?.classList.remove('selected');
            target.classList.add('selected');
        }
    });

    if (badgeSelectionGrid) badgeSelectionGrid.addEventListener('click', (e) => {
        const target = e.target.closest('.badge-icon-container');
        if (target && !target.classList.contains('locked')) {
            const currentSelected = badgeSelectionGrid.querySelector('.selected');
            if (currentSelected === target) { // If clicking the already selected one, deselect it
                currentSelected.classList.remove('selected');
            } else {
                currentSelected?.classList.remove('selected');
                target.classList.add('selected');
            }
        }
    });

    // Scrims et Modales
    showScrimModalButton.addEventListener('click', () => {
        updateProfileView();
        if (!isCurrentUserPremium && userDailyStats.dailyScrims >= 2) {
            premiumPromptModal.style.display = 'flex';
            return;
        }
        createScrimModal.style.display = 'flex';
    });

    createScrimForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = createScrimForm.querySelector('button[type="submit"]');
        const totalMinutes = (parseInt(document.getElementById('scrim-hours').value) || 0) * 60 + (parseInt(document.getElementById('scrim-minutes').value) || 0);
        if (totalMinutes <= 0 || totalMinutes > 2880) {
            alert("La durée doit être entre 1 minute et 48 heures."); return;
        }
        const scrimData = {
            creator: loggedInUsername,
            roomName: document.getElementById('scrim-name').value,
            gameId: document.getElementById('scrim-game-id').value,
            avgRank: document.getElementById('scrim-rank').value,
            startsInMinutes: totalMinutes,
        };
        try {
            submitButton.disabled = true; submitButton.textContent = 'Création...';
            const response = await fetch(`${API_URL}/scrims`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scrimData) });
            if (!response.ok) throw new Error((await response.json()).error || "Erreur de création");
            if (!isCurrentUserPremium) {
                userDailyStats.dailyScrims++;
                localStorage.setItem('userDailyStats', JSON.stringify(userDailyStats));
            }
            createScrimForm.reset();
            createScrimModal.style.display = 'none';
            await renderScrims();
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        } finally {
            submitButton.disabled = false; submitButton.textContent = 'Créer le salon';
        }
    });
    
    scrimsListContainer.addEventListener('click', async (e) => {
        const target = e.target.closest('button, .admin-delete-scrim');
        if (!target) return;
        const scrimId = target.dataset.scrimId;
        if (!scrimId && !target.closest('.save-id-button')) return;

        try {
            if (target.matches('.admin-delete-scrim')) {
                if (confirm('Supprimer définitivement ce scrim ?')) {
                    await fetch(`${API_URL}/scrims/${scrimId}?requestingUser=${loggedInUsername}`, { method: 'DELETE' });
                }
            } else if (target.matches('.join-button')) {
                await fetch(`${API_URL}/scrims/${scrimId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUsername }) });
            } else if (target.matches('.leave-button')) {
                await fetch(`${API_URL}/scrims/${scrimId}/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUsername }) });
            } else if (target.matches('.edit-id-button')) {
                const container = target.closest('.game-id-container');
                const textSpan = container.querySelector('.game-id-text');
                container.innerHTML = `<input type="text" class="edit-id-input" value="${textSpan.textContent === 'Non défini' ? '' : textSpan.textContent}" placeholder="ID"><button class="save-id-button" data-scrim-id="${container.dataset.scrimId}"><img src="images/confirme.png" alt="OK"></button>`;
                container.querySelector('input').focus();
                return;
            } else if (target.closest('.save-id-button')) {
                const saveButton = target.closest('.save-id-button');
                const newId = saveButton.parentElement.querySelector('.edit-id-input').value.trim();
                await fetch(`${API_URL}/scrims/${saveButton.dataset.scrimId}/gameid`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: newId }) });
            }
            await renderScrims();
        } catch (error) {
            alert((error.message || "Une erreur est survenue.").error);
        }
    });
    
    closeScrimModalButton.addEventListener('click', () => createScrimModal.style.display = 'none');
    closePremiumPromptButton.addEventListener('click', () => premiumPromptModal.style.display = 'none');
    cancelPremiumPromptButton.addEventListener('click', () => premiumPromptModal.style.display = 'none');
    window.addEventListener('click', (e) => { 
        if (e.target == createScrimModal) createScrimModal.style.display = 'none';
        if (e.target == premiumPromptModal) premiumPromptModal.style.display = 'none';
        if (e.target == adminCustomizationModal) adminCustomizationModal.style.display = 'none';
        if (e.target == adminBanModal) adminBanModal.style.display = 'none';
    });
    
    // Paramètres
    playerIdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const playerInfo = playerIdInput.value.trim();
        if (playerInfo) {
            localStorage.setItem(`playerID_${loggedInUsername}`, playerInfo);
            settingsMessage.textContent = 'Enregistré avec succès !';
            settingsMessage.className = 'success';
        } else {
            settingsMessage.textContent = 'Veuillez entrer une information valide.';
            settingsMessage.className = 'error';
        }
    });

    // GESTIONNAIRE D'ÉVÉNEMENTS GLOBAL POUR LE PANNEAU ADMIN
    adminUserListContainer.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
    
        const username = target.dataset.username;
    
        if (target.classList.contains('manage-cosmetics-btn')) {
            openCustomizationModal(username);
            return;
        }
    
        if (target.classList.contains('unban-btn')) {
            if (confirm(`Êtes-vous sûr de vouloir débannir ${username} ?`)) {
                try {
                    const response = await fetch(`${API_URL}/admin/ban`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            requestingUser: loggedInUsername,
                            usernameToBan: username,
                            type: 'unban'
                        })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    alert(data.message);
                    await renderAdminUsers(adminUserSearch.value);
                } catch (error) {
                    alert(`Erreur: ${error.message}`);
                }
            }
        }
    
        if (target.classList.contains('ban-user-btn')) {
            banModalUsername.textContent = username;
            banningUsernameHidden.value = username;
            adminBanModal.style.display = 'flex';
            // Réinitialiser l'état de la modale
            banTypeTempRadio.checked = true;
            banDurationContainer.style.display = 'block';
            banDurationInput.value = 7;
            document.getElementById('ban-modal-message').textContent = '';
        }
    });

    // Événements pour la modale de bannissement
    banTypePermRadio.addEventListener('change', () => {
        if (banTypePermRadio.checked) {
            banDurationContainer.style.display = 'none';
        }
    });
    banTypeTempRadio.addEventListener('change', () => {
        if (banTypeTempRadio.checked) {
            banDurationContainer.style.display = 'block';
        }
    });

    adminBanModal.querySelector('.modal-close-button').addEventListener('click', () => {
        adminBanModal.style.display = 'none';
    });

    confirmBanButton.addEventListener('click', async () => {
        const usernameToBan = banningUsernameHidden.value;
        const banType = document.querySelector('input[name="ban-type"]:checked').value;
        const duration = banDurationInput.value;
        const messageEl = document.getElementById('ban-modal-message');

        if (banType === 'temporary' && (!duration || parseInt(duration) <= 0)) {
            messageEl.textContent = 'Veuillez entrer une durée valide.';
            messageEl.className = 'error';
            return;
        }
        
        const requestBody = {
            requestingUser: loggedInUsername,
            usernameToBan: usernameToBan,
            type: banType,
        };
        
        if (banType === 'temporary') {
            requestBody.durationInDays = parseInt(duration);
        }

        try {
            confirmBanButton.disabled = true;
            confirmBanButton.textContent = 'Application...';
            messageEl.textContent = '';

            const response = await fetch(`${API_URL}/admin/ban`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            alert(data.message);
            adminBanModal.style.display = 'none';
            await renderAdminUsers(adminUserSearch.value);

        } catch (error) {
            messageEl.textContent = `Erreur: ${error.message}`;
            messageEl.className = 'error';
        } finally {
            confirmBanButton.disabled = false;
            confirmBanButton.textContent = 'Confirmer le bannissement';
        }
    });


    // Sauvegarde des changements dans la modale de cosmétiques
    document.getElementById('admin-save-customizations-button').addEventListener('click', async () => {
        const username = document.getElementById('editing-username-hidden').value;
        const colorsContainer = document.getElementById('admin-colors-list');
        const badgesContainer = document.getElementById('admin-badges-list');
        
        const selectedColors = ['default']; // 'default' est toujours inclus
        colorsContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(input => {
            if (input.value !== 'default') selectedColors.push(input.value);
        });
        
        const selectedBadges = ['none']; // 'none' est toujours inclus
        badgesContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(input => {
             if (input.value !== 'none') selectedBadges.push(input.value);
        });

        try {
            const response = await fetch(`${API_URL}/admin/user/customizations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestingUser: loggedInUsername,
                    username,
                    colors: selectedColors,
                    badges: selectedBadges
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            alert(data.message);
            adminCustomizationModal.style.display = 'none';

        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    });

    // Fermeture de la modale de cosmétiques
    adminCustomizationModal.querySelector('.modal-close-button').addEventListener('click', () => {
        adminCustomizationModal.style.display = 'none';
    });
    
    // Recherche d'utilisateur admin
    if (adminUserSearch) {
        adminUserSearch.addEventListener('input', () => renderAdminUsers(adminUserSearch.value));
    }


    // --- INITIALISATION DE LA PAGE ---

    // On vérifie les paramètres dans l'URL pour détecter un retour de paiement réussi
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        alert('Paiement réussi ! Votre compte est mis à jour avec vos avantages Premium.');

        isCurrentUserPremium = true;
        localStorage.setItem('isPremium', 'true');

        const unlockedColors = new Set(userCustomization.unlockedColors);
        ['premium-gradient', 'supporter-gold'].forEach(color => unlockedColors.add(color));
        userCustomization.unlockedColors = Array.from(unlockedColors);

        const unlockedBadges = new Set(userCustomization.unlockedBadges);
        ['premium', 'supporter-gold'].forEach(badge => unlockedBadges.add(badge));
        userCustomization.unlockedBadges = Array.from(unlockedBadges);
        
        localStorage.setItem('userCustomization', JSON.stringify(userCustomization));

        updateUserDisplay(loggedInUsername, userCustomization);
        updateProfileView();
        renderProfileCustomization(); 

        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Code d'initialisation standard qui s'exécute à chaque chargement
    if (usernameDisplay) usernameDisplay.textContent = loggedInUsername;
    updateUserDisplay(loggedInUsername, userCustomization);
    updateProfileView();
    showSection('home');

    if (loggedInUsername.toLowerCase() === 'brawlarena.gg') {
        if(adminLinkLi) adminLinkLi.style.display = 'list-item';
    }

    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    setInterval(updateAllCountdowns, 1000);
});