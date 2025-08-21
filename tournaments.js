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
                const userTeam = t.teamDetails.find(team => team.members.includes(loggedInUsername));
                const isTournamentFull = t.teamDetails.length >= t.maxParticipants;
                const isTournamentStarted = t.status === 'Ongoing';

                // --- Rendu de la liste des équipes ---
                let teamsHTML = '<div class="teams-list-container">';
                if (t.teamDetails.length > 0) {
                    teamsHTML += t.teamDetails.map(team => {
                        let joinButtonHTML = '';
                        if (!userTeam && !isTournamentStarted && team.members.length < 3) {
                            if (team.isPrivate) {
                                joinButtonHTML = `<button class="button join-private-team-btn" data-team-id="${team._id}">Code</button>`;
                            } else {
                                joinButtonHTML = `<button class="button join-team-btn" data-team-id="${team._id}">Rejoindre</button>`;
                            }
                        }
                        return `<div class="team-entry">
                            <span><strong>${team.name}</strong> (${team.members.length}/3) - ${team.isPrivate ? '<em>Privée</em>' : '<em>Publique</em>'}</span>
                            ${joinButtonHTML}
                        </div>`;
                    }).join('');
                } else {
                    teamsHTML += '<p style="font-size: 0.9em; color: var(--text-dark);">Aucune équipe inscrite pour le moment.</p>';
                }
                teamsHTML += '</div>';

                // --- Rendu des boutons d'action principaux ---
                let actionsHTML = '';
                if (isTournamentStarted && t.bracket) {
                     actionsHTML = `<button class="button view-bracket-btn" data-tournament-id="${t._id}" data-tournament-name="${t.name}">Voir l'Arbre</button>`;
                } else if (new Date(t.dateTime) < new Date() && t.creator === loggedInUsername && !t.bracket) {
                     actionsHTML = `<button class="button start-tournament-btn" data-tournament-id="${t._id}">Lancer le Tournoi</button>`;
                } else {
                    if (!userTeam && !isTournamentFull) {
                        actionsHTML = `<button class="button create-team-btn" data-tournament-id="${t._id}">Créer une Équipe</button>`;
                    } else if (userTeam) {
                        actionsHTML = `<p style="color:var(--success-color);">Vous êtes dans l'équipe : ${userTeam.name}</p>`;
                    } else if (isTournamentFull) {
                        actionsHTML = `<p style="color:var(--text-dark);">Tournoi complet</p>`;
                    }
                }

                return `
                <div class="scrim-card">
                    <h3>${t.name}</h3>
                    <p><strong>Organisateur :</strong> ${t.creator}</p>
                    <p><strong>Date :</strong> ${new Date(t.dateTime).toLocaleString('fr-FR')}</p>
                    <p><strong>Équipes :</strong> ${t.teamDetails.length} / ${t.maxParticipants}</p>
                    <p><strong>Récompense :</strong> ${t.prize || 'Aucune'}</p>
                    ${teamsHTML}
                    <div class="scrim-actions">${actionsHTML}</div>
                </div>`;
            }).join('');

        } catch (error) {
            tournamentsListContainer.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    function renderBracket(bracketData, tournamentName) {
        document.getElementById('bracket-modal-title').textContent = `Arbre - ${tournamentName}`;
        if (!bracketData || !bracketData.rounds) {
            bracketContainer.innerHTML = "<p>L'arbre de tournoi n'est pas encore disponible.</p>";
            return;
        }
        let bracketHTML = '';
        bracketData.rounds.forEach((round, index) => {
            bracketHTML += `<div class="bracket-round"><h4>Round ${index + 1}</h4>`;
            round.forEach(match => {
                const team1 = match.teams[0];
                const team2 = match.teams[1];
                const winnerId = match.winner;

                const team1Name = team1 ? team1.name : 'En attente';
                const team2Name = team2 ? team2.name : 'En attente';
                
                const team1Class = `bracket-team ${winnerId === (team1 && team1.id) ? 'winner' : ''} ${team1Name === 'BYE' ? 'bye' : ''}`;
                const team2Class = `bracket-team ${winnerId === (team2 && team2.id) ? 'winner' : ''} ${team2Name === 'En attente' ? 'bye': ''}`;
                
                bracketHTML += `
                    <div class="bracket-match">
                        <div class="${team1Class}">${team1Name}</div>
                        <div class="vs-text">VS</div>
                        <div class="${team2Class}">${team2Name}</div>
                    </div>
                `;
            });
            bracketHTML += `</div>`;
        });
        bracketContainer.innerHTML = bracketHTML;
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    
    // Clics sur les boutons dynamiques dans la liste des tournois
    tournamentsListContainer.addEventListener('click', async (e) => {
        const target = e.target;
        
        // Créer une équipe
        if (target.matches('.create-team-btn')) {
            document.getElementById('team-tournament-id').value = target.dataset.tournamentId;
            createTeamModal.style.display = 'flex';
        }
        // Rejoindre une équipe publique
        if (target.matches('.join-team-btn')) {
            if (!confirm("Voulez-vous rejoindre cette équipe ?")) return;
            try {
                const response = await fetch(`${API_URL}/teams/${target.dataset.teamId}/join`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ username: loggedInUsername })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                alert(data.message);
                fetchAndRenderTournaments();
            } catch (err) { alert(`Erreur: ${err.message}`); }
        }
        // Rejoindre une équipe privée (ouvre le modal)
        if (target.matches('.join-private-team-btn')) {
            document.getElementById('join-team-id').value = target.dataset.teamId;
            joinPrivateTeamModal.style.display = 'flex';
        }
        // Voir l'arbre de tournoi
        if (target.matches('.view-bracket-btn')) {
            try {
                const res = await fetch(`${API_URL}/tournaments`);
                const tournaments = await res.json();
                const tournament = tournaments.find(t => t._id === target.dataset.tournamentId);
                renderBracket(tournament.bracket, target.dataset.tournamentName);
                bracketModal.style.display = 'flex';
            } catch(err) { alert("Erreur pour récupérer l'arbre."); }
        }
        // Démarrer le tournoi (Générer l'arbre)
        if (target.matches('.start-tournament-btn')) {
            if (!confirm("Voulez-vous vraiment lancer le tournoi ? L'arbre sera généré et les inscriptions fermées.")) return;
            try {
                const response = await fetch(`${API_URL}/tournaments/${target.dataset.tournamentId}/bracket`, { method: 'POST' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                alert(data.message);
                fetchAndRenderTournaments();
            } catch (err) { alert(`Erreur: ${err.message}`); }
        }
    });

    // Soumission du formulaire de création d'équipe
    createTeamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tournamentId = document.getElementById('team-tournament-id').value;
        const teamName = document.getElementById('team-name').value;
        const isPrivate = isPrivateCheckbox.checked;
        const joinCode = document.getElementById('team-join-code').value;

        if (isPrivate && !joinCode) {
            alert("Veuillez entrer un code pour votre équipe privée.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/teams`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tournamentId, teamName, creator: loggedInUsername, isPrivate, joinCode })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            alert("Équipe créée avec succès !");
            createTeamModal.style.display = 'none';
            createTeamForm.reset();
            isPrivateCheckbox.checked = false;
            joinCodeContainer.style.display = 'none';
            fetchAndRenderTournaments();
        } catch (err) { alert(`Erreur: ${err.message}`); }
    });
    
    // Soumission du formulaire pour rejoindre une équipe privée
    joinPrivateTeamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const teamId = document.getElementById('join-team-id').value;
        const joinCode = document.getElementById('join-code-input').value;
        try {
            const response = await fetch(`${API_URL}/teams/${teamId}/join`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: loggedInUsername, joinCode })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            alert(data.message);
            joinPrivateTeamModal.style.display = 'none';
            joinPrivateTeamForm.reset();
            fetchAndRenderTournaments();
        } catch (err) { alert(`Erreur: ${err.message}`); }
    });

    // Afficher/Cacher le champ du code pour équipe privée
    isPrivateCheckbox.addEventListener('change', () => {
        joinCodeContainer.style.display = isPrivateCheckbox.checked ? 'block' : 'none';
    });
    
    // Logique d'ouverture/fermeture des modals
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
    if (isPremium) showTournamentModalButton.style.display = 'block';
    updateUtcClock();
    setInterval(updateUtcClock, 1000);
    fetchAndRenderTournaments();
});