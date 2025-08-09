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

    // --- SÉLECTION DES ÉLÉMENTS DU DOM ---
    const displayUsername = document.getElementById('display-username');
    const utcClockElement = document.getElementById('utc-clock');
    const showTournamentModalButton = document.getElementById('show-tournament-modal-button');
    const createTournamentModal = document.getElementById('create-tournament-modal');
    const limitPromptModal = document.getElementById('limit-prompt-modal');
    const createTournamentForm = document.getElementById('create-tournament-form');
    const tournamentsListContainer = document.getElementById('tournaments-list-container');
    
    // --- FONCTIONS ---

    function updateUtcClock() {
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

    async function fetchAndRenderTournaments() {
        tournamentsListContainer.innerHTML = '<p>Chargement des tournois...</p>';
        try {
            const response = await fetch(`${API_URL}/tournaments`);
            if (!response.ok) throw new Error('Impossible de charger les tournois.');
            const tournaments = await response.json();

            if (tournaments.length === 0) {
                tournamentsListContainer.innerHTML = '<p>Aucun tournoi n\'est actuellement programmé. Soyez le premier à en créer un !</p>';
                return;
            }
            // Ici, vous pourriez construire des cartes pour chaque tournoi, comme pour les scrims.
            // Pour l'instant, nous affichons une version simplifiée.
            tournamentsListContainer.innerHTML = tournaments.map(t => `
                <div class="scrim-card">
                    <h3>${t.name}</h3>
                    <p><strong>Organisateur :</strong> ${t.creator}</p>
                    <p><strong>Date :</strong> ${new Date(t.dateTime).toLocaleString('fr-FR')}</p>
                    <p><strong>Format :</strong> ${t.format}</p>
                    <p><strong>Participants :</strong> ${t.participants.length} / ${t.maxParticipants}</p>
                    <p><strong>Récompense :</strong> ${t.prize || 'Aucune'}</p>
                    <div class="scrim-actions">
                        <button class="button" disabled>Rejoindre (bientôt)</button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            tournamentsListContainer.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

    showTournamentModalButton.addEventListener('click', () => {
        if (checkDailyLimit() >= 1) {
            limitPromptModal.style.display = 'flex';
        } else {
            createTournamentModal.style.display = 'flex';
        }
    });

    createTournamentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = createTournamentForm.querySelector('button[type="submit"]');
        
        const tournamentData = {
            creator: loggedInUsername,
            name: document.getElementById('tournament-name').value,
            description: document.getElementById('tournament-description').value,
            dateTime: document.getElementById('tournament-datetime').value,
            format: document.getElementById('tournament-format').value,
            maxParticipants: parseInt(document.getElementById('tournament-participants').value),
            prize: document.getElementById('tournament-prize').value
        };

        try {
            submitButton.disabled = true;
            submitButton.textContent = "Création...";
            const response = await fetch(`${API_URL}/tournaments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tournamentData)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erreur de création du tournoi.");
            
            // Met à jour le compteur local
            userDailyStats.dailyTournaments = (userDailyStats.dailyTournaments || 0) + 1;
            userDailyStats.lastTournamentDate = new Date().toISOString().split('T')[0];
            localStorage.setItem('userDailyStats', JSON.stringify(userDailyStats));

            createTournamentForm.reset();
            createTournamentModal.style.display = 'none';
            await fetchAndRenderTournaments();

        } catch (error) {
            alert(`Erreur: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Créer le Tournoi';
        }
    });

    // Fermeture des modales
    [createTournamentModal, limitPromptModal].forEach(modal => {
        modal.querySelector('.modal-close-button').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });
    limitPromptModal.querySelector('.secondary-button').addEventListener('click', () => {
        limitPromptModal.style.display = 'none';
    });


    // --- INITIALISATION DE LA PAGE ---
    if (displayUsername) displayUsername.textContent = loggedInUsername;
    if (isPremium) {
        showTournamentModalButton.style.display = 'block';
    }
    
    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    fetchAndRenderTournaments();
});