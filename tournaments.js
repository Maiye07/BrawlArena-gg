document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ET VÉRIFICATION UTILISATEUR ---
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    const API_URL = 'https://brawlarena-gg.onrender.com';
    const isPremium = localStorage.getItem('isPremium') === 'true';
    let userDailyStats = JSON.parse(localStorage.getItem('userDailyStats')) || {};

    // --- SÉLECTION DES ÉLÉNEMENTS DU DOM ---
    const tournamentsListContainer = document.getElementById('tournaments-list-container');
    const showTournamentModalButton = document.getElementById('show-tournament-modal-button');
    // Modals principaux
    const createTournamentModal = document.getElementById('create-tournament-modal');
    const limitPromptModal = document.getElementById('limit-prompt-modal');
    // Nouveaux modals pour équipes/arbre
    const createTeamModal = document.getElementById('create-team-modal');
    const joinPrivateTeamModal = document.getElementById('join-private-team-modal');
    const bracketModal = document.getElementById('bracket-modal');
    // Formulaires & Inputs
    const createTournamentForm = document.getElementById('create-tournament-form');
    const createTeamForm = document.getElementById('create-team-form');
    const joinPrivateTeamForm = document.getElementById('join-private-team-form');
    const isPrivateCheckbox = document.getElementById('team-is-private');
    const joinCodeContainer = document.getElementById('team-join-code-container');
    const bracketContainer = document.getElementById('bracket-container');

    // --- FONCTIONS UTILITAIRES ---
    
    function updateUtcClock() {
        const utcClockElement = document.getElementById('utc-clock');
        if (!utcClockElement) return;
        const now = new Date();
        utcClockElement.textContent = `UTC ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    }

    function checkDailyLimit() {
        const today = new Date().toISOString().split('T')[0];
        // Réinitialise le compteur si le dernier tournoi n'a pas été créé aujourd'hui
        if (userDailyStats.lastTournamentDate !== today) {
            userDailyStats.dailyTournaments = 0;
            localStorage.setItem('userDailyStats', JSON.stringify(userDailyStats));
        }
        return userDailyStats.dailyTournaments || 0;
    }

    // --- LOGIQUE PRINCIPALE ---
    
    async function fetchAndRenderTournaments() {
        tournamentsListContainer.innerHTML = '<p>Chargement des tournois...</p>';
        try {
            const response = await fetch(`${API_URL}/tournaments`);
            if (!response.ok) throw new Error('Impossible de charger les tournois.');
            const tournaments = await response.json();

            if (tournaments.length === 0) {
                tournamentsListContainer.innerHTML = '<p>Aucun tournoi n\'est actuellement programmé.</p>';
                return;
            }

            tournamentsListContainer.innerHTML = tournaments.map(t => {
                const adminDeleteIcon = (loggedInUsername.toLowerCase() === 'brawlarena.gg')
                    ? `<span class="admin-delete-tournament" data-tournament-id="${t._id}" title="Supprimer le tournoi">🗑️</span>`
                    : '';
    
                // --- Le seul bouton est maintenant celui pour voir les détails ---
                const actionsHTML = `<a href="tournament-detail.html?id=${t._id}" class="button">Voir le Tournoi</a>`;
    
                return `
                <div class="scrim-card">
                    ${adminDeleteIcon}
                    <h3>${t.name}</h3>
                    <p><strong>Organisateur :</strong> ${t.creator}</p>
                    <p><strong>Date :</strong> ${new Date(t.dateTime).toLocaleString('fr-FR')}</p>
                    <p><strong>Équipes :</strong> ${t.teamDetails.length} / ${t.maxParticipants}</p>
                    <p><strong>Récompense :</strong> ${t.prize || 'Aucune'}</p>
                    <div class="scrim-actions">${actionsHTML}</div>
                </div>`;
            }).join('');
    
        } catch (error) {
            tournamentsListContainer.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    
    tournamentsListContainer.addEventListener('click', async (e) => {
        const target = e.target;
        
        if (target.matches('.admin-delete-tournament')) {
            const tournamentId = target.dataset.tournamentId;
            if (confirm("Voulez-vous vraiment supprimer ce tournoi ?\n\nToutes les équipes inscrites seront également supprimées. Cette action est irréversible.")) {
                try {
                    const response = await fetch(`${API_URL}/tournaments/${tournamentId}?requestingUser=${loggedInUsername}`, {
                        method: 'DELETE'
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || `Erreur HTTP ${response.status}`);
                    alert(data.message);
                    fetchAndRenderTournaments();
                } catch (err) {
                    alert(`Erreur: ${err.message}`);
                }
            }
            return; 
        }

        // Les autres actions (créer/rejoindre équipe) sont maintenant sur la page de détail
    });

    // --- DÉBUT DE L'AJOUT : GESTION DE LA CRÉATION DE TOURNOI ---
    createTournamentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tournamentData = {
            name: document.getElementById('tournament-name').value,
            description: document.getElementById('tournament-description').value,
            dateTime: document.getElementById('tournament-datetime').value,
            format: document.getElementById('tournament-format').value,
            maxParticipants: parseInt(document.getElementById('tournament-participants').value, 10),
            prize: document.getElementById('tournament-prize').value,
            creator: loggedInUsername
        };

        if (new Date(tournamentData.dateTime) < new Date()) {
            alert("La date du tournoi doit être dans le futur.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/tournaments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tournamentData)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Erreur HTTP ${response.status}`);
            }

            alert('Tournoi créé avec succès !');
            createTournamentModal.style.display = 'none';
            createTournamentForm.reset();

            const today = new Date().toISOString().split('T')[0];
            userDailyStats.dailyTournaments = 1;
            userDailyStats.lastTournamentDate = today;
            localStorage.setItem('userDailyStats', JSON.stringify(userDailyStats));

            fetchAndRenderTournaments();

        } catch (err) {
            alert(`Erreur lors de la création du tournoi: ${err.message}`);
        }
    });
    // --- FIN DE L'AJOUT ---

    // La logique pour les formulaires de création/rejoindre équipe n'est plus nécessaire ici
    
    showTournamentModalButton.addEventListener('click', () => {
        if (checkDailyLimit() >= 1) {
            limitPromptModal.style.display = 'flex';
        } else {
            createTournamentModal.style.display = 'flex';
        }
    });
    
    [createTournamentModal, limitPromptModal, createTeamModal, joinPrivateTeamModal, bracketModal].forEach(modal => {
        if (!modal) return;
        const closeButton = modal.querySelector('.modal-close-button');
        if(closeButton) closeButton.addEventListener('click', () => modal.style.display = 'none');
        
        const secondaryButton = modal.querySelector('.secondary-button');
        if(secondaryButton) secondaryButton.addEventListener('click', () => modal.style.display = 'none');
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // --- INITIALISATION DE LA PAGE ---
    if (isPremium) {
      const usernameDisplay = document.getElementById('display-username');
      if (usernameDisplay) {
        usernameDisplay.textContent = loggedInUsername;
      }
      showTournamentModalButton.style.display = 'block';
    }
    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    fetchAndRenderTournaments();
});