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
    let userDailyStats = JSON.parse(localStorage.getItem('userDailyStats')) || { dailyScrims: 0, lastActivityDate: new Date().toISOString().split('T')[0] };
    let userCustomization = JSON.parse(localStorage.getItem('userCustomization')) || {
        activeColor: 'default',
        activeBadge: 'none',
        unlockedColors: ['default', 'premium-gradient'],
        unlockedBadges: ['none', 'premium']
    };

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

    const showUsersButton = document.getElementById('show-users-button');
    const usersListContainer = document.getElementById('users-list-container');

    const adminLinkLi = document.getElementById('admin-link-li');
    const adminUserListContainer = document.getElementById('admin-user-list-container');
    const adminUserSearch = document.getElementById('admin-user-search');

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

                        // MODIFIÉ ICI : Le pseudo est maintenant avant le badge
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
            // MODIFIÉ ICI : Le span du pseudo est avant l'image du badge
            profileUserDisplay.innerHTML = `
                <span class="username-text-display ${colorClass}">${loggedInUsername}</span>
                ${badgeSrc ? `<img src="${badgeSrc}" alt="Badge" class="player-badge">` : ''}
            `;
        }
    }
    
    function renderProfileCustomization() {
        if (!colorSelectionGrid || !badgeSelectionGrid) return;
        colorSelectionGrid.innerHTML = '';
        badgeSelectionGrid.innerHTML = '';

        userCustomization.unlockedColors.forEach(colorId => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.colorId = colorId;
            swatch.innerHTML = `<span class="${colorClassMap[colorId] || ''}">Aa</span>`;
            if (colorId === userCustomization.activeColor) swatch.classList.add('selected');
            if (colorId.includes('premium') && !isCurrentUserPremium) {
                swatch.classList.add('locked');
                swatch.title = "Réservé aux membres Premium";
            }
            colorSelectionGrid.appendChild(swatch);
        });

        userCustomization.unlockedBadges.forEach(badgeId => {
            const badgeSrc = badgeImageMap[badgeId];
            if (!badgeSrc) return;
            const container = document.createElement('div');
            container.className = 'badge-icon-container';
            container.dataset.badgeId = badgeId;
            container.innerHTML = `<img src="${badgeSrc}" alt="Badge ${badgeId}">`;
            if (badgeId === userCustomization.activeBadge) container.classList.add('selected');
            if (badgeId.includes('premium') && !isCurrentUserPremium) {
                container.classList.add('locked');
                container.title = "Réservé aux membres Premium";
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
    
    async function renderAdminUsers() {
        adminUserListContainer.innerHTML = `<p>Chargement...</p>`;
        try {
            const response = await fetch(`${API_URL}/admin/users?requestingUser=${loggedInUsername}`);
            if (!response.ok) throw new Error((await response.json()).error || 'Erreur de chargement.');
            
            const users = await response.json();
            let usersHTML = users.filter(user => user.username.toLowerCase() !== 'brawlarena.gg').map(user => {
                let statusHTML = '<span class="status-ok">Actif</span>';
                let actionsHTML = `<button class="button ban-temp-btn" data-username="${user.username}">Ban Temp</button> <button class="button ban-perm-btn" data-username="${user.username}">Ban Perm</button>`;

                if (user.isBannedPermanently) {
                    statusHTML = '<span class="status-banned">Banni Permanent</span>';
                    actionsHTML = `<button class="button unban-btn" data-username="${user.username}">Débannir</button>`;
                } else if (user.banExpiresAt && new Date(user.banExpiresAt) > new Date()) {
                    statusHTML = `<span class="status-banned">Banni (jusqu'au ${new Date(user.banExpiresAt).toLocaleDateString('fr-FR')})</span>`;
                    actionsHTML = `<button class="button unban-btn" data-username="${user.username}">Débannir</button>`;
                }
                
                return `<div class="admin-user-row">
                          <span class="admin-user-info"><strong>${user.username}</strong> ${user.isPremium ? '<span>- 👑 Premium</span>' : ''}</span>
                          <span class="admin-user-status">${statusHTML}</span>
                          <span class="admin-user-actions">${actionsHTML}</span>
                        </div>`;
            }).join('');
            
            adminUserListContainer.innerHTML = `<div class="admin-user-table">${usersHTML}</div>`;
        } catch (error) {
            adminUserListContainer.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

    // Navigation
    links.scrims.addEventListener('click', (e) => { e.preventDefault(); renderScrims(); showSection('scrims'); });
    links.settings.addEventListener('click', (e) => { e.preventDefault(); showSection('settings'); });
    links.about.addEventListener('click', (e) => { e.preventDefault(); showSection('about'); });
    links.tournaments.addEventListener('click', (e) => { e.preventDefault(); alert('La section Tournois est en cours de développement !'); });
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
            updateUserDisplay(loggedInUsername, userCustomization);
            updateProfileView();
            alert(`Statut Premium ${isCurrentUserPremium ? 'activé' : 'désactivé'} !`);
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    });
    
    // Personnalisation
    if (saveCustomizationButton) {
        saveCustomizationButton.addEventListener('click', async () => {
            const newColor = colorSelectionGrid.querySelector('.selected')?.dataset.colorId || userCustomization.activeColor;
            const newBadge = badgeSelectionGrid.querySelector('.selected')?.dataset.badgeId || 'none';

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
            if (currentSelected === target) currentSelected.classList.remove('selected');
            else {
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

    // --- INITIALISATION DE LA PAGE ---
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