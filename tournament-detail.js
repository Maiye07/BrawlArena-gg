document.addEventListener('DOMContentLoaded', () => {
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    const API_URL = 'https://brawlarena-gg.onrender.com';
    const detailContainer = document.getElementById('tournament-detail-container');

    // --- SÉLECTION DES ÉLÉMENTS MODALS ---
    const createTeamModal = document.getElementById('create-team-modal');
    const joinPrivateTeamModal = document.getElementById('join-private-team-modal');
    const createTeamForm = document.getElementById('create-team-form');
    const joinPrivateTeamForm = document.getElementById('join-private-team-form');
    const isPrivateCheckbox = document.getElementById('team-is-private');
    const joinCodeContainer = document.getElementById('team-join-code-container');

    // 1. Récupérer l'ID du tournoi depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id');

    if (!tournamentId) {
        detailContainer.innerHTML = '<p class="error">Aucun ID de tournoi fourni. <a href="tournaments.html">Retour à la liste</a>.</p>';
        return;
    }

    // 2. Fonction pour fetcher et rendre les détails
    async function fetchAndRenderTournamentDetails() {
        try {
            detailContainer.innerHTML = '<p>Chargement des détails du tournoi...</p>';
            const response = await fetch(`${API_URL}/tournaments/${tournamentId}`);

            // --- DÉBUT DE LA CORRECTION ---
            if (!response.ok) {
                let errorMessage = `Erreur HTTP ${response.status}: ${response.statusText}`;
                
                // Vérifie si la réponse est du JSON avant de la parser
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errData = await response.json();
                    errorMessage = errData.error || 'Tournoi non trouvé.';
                } else {
                    // Si ce n'est pas du JSON, on lit la réponse en tant que texte
                    const textError = await response.text();
                    console.error("Réponse non-JSON du serveur:", textError); // Log pour le débogage
                    errorMessage = 'Le serveur a renvoyé une réponse inattendue. L\'ID du tournoi est peut-être incorrect.';
                }
                throw new Error(errorMessage);
            }
            // --- FIN DE LA CORRECTION ---

            const t = await response.json(); // 't' pour tournament

            const userTeam = t.teamDetails.find(team => team.members.includes(loggedInUsername));
            const isTournamentFull = t.teamDetails.length >= t.maxParticipants;
            const isTournamentStarted = t.status === 'Ongoing' || t.status === 'Finished';

            // Rendu de la liste des équipes
            let teamsHTML = '<h4>Équipes Inscrites</h4><div class="teams-list-container">';
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
                teamsHTML += '<p>Aucune équipe inscrite.</p>';
            }
            teamsHTML += '</div>';

            // Rendu des actions principales
            let actionsHTML = '<div class="scrim-actions">';
            if (isTournamentStarted && t.bracket) {
                // L'arbre est déjà affiché plus bas, pas besoin de bouton supplémentaire ici.
            } else if (new Date(t.dateTime) < new Date() && t.creator === loggedInUsername && !t.bracket) {
                actionsHTML += `<button class="button start-tournament-btn" data-tournament-id="${t._id}">Lancer le Tournoi</button>`;
            } else if (!isTournamentStarted) {
                if (!userTeam && !isTournamentFull) {
                    actionsHTML += `<button class="button create-team-btn" data-tournament-id="${t._id}">Créer une Équipe</button>`;
                } else if (userTeam) {
                    actionsHTML += `<p style="color:var(--success-color);">Vous êtes dans l'équipe : ${userTeam.name}</p>`;
                } else if (isTournamentFull) {
                    actionsHTML += `<p style="color:var(--text-dark);">Tournoi complet</p>`;
                }
            }
             actionsHTML += '</div>';

            // Rendu de l'arbre si le tournoi a commencé
            let bracketHTML = '';
            if (isTournamentStarted && t.bracket) {
                bracketHTML += '<h3>Arbre du tournoi</h3><div id="bracket-container" class="bracket-container">';
                t.bracket.rounds.forEach((round, index) => {
                    bracketHTML += `<div class="bracket-round"><h4>Round ${index + 1}</h4>`;
                    round.forEach(match => {
                        const team1 = match.teams[0];
                        const team2 = match.teams[1];
                        const winnerId = match.winner;
                        const team1Name = team1 ? team1.name : 'En attente';
                        const team2Name = team2 ? team2.name : 'En attente';
                        const team1Class = `bracket-team ${winnerId === (team1 && team1.id) ? 'winner' : ''} ${team1Name === 'BYE' ? 'bye' : ''}`;
                        const team2Class = `bracket-team ${winnerId === (team2 && team2.id) ? 'winner' : ''} ${team2Name === 'En attente' ? 'bye': ''}`;
                        bracketHTML += `<div class="bracket-match"><div class="${team1Class}">${team1Name}</div><div class="vs-text">VS</div><div class="${team2Class}">${team2Name}</div></div>`;
                    });
                    bracketHTML += `</div>`;
                });
                bracketHTML += '</div>';
            }

            // 3. Injecter le HTML final dans le conteneur
            detailContainer.innerHTML = `
                <h1>${t.name}</h1>
                <p><strong>Organisateur :</strong> ${t.creator}</p>
                <p><strong>Date :</strong> ${new Date(t.dateTime).toLocaleString('fr-FR')}</p>
                <p><strong>Format :</strong> ${t.format}</p>
                <p><strong>Statut :</strong> ${t.status}</p>
                <p><strong>Équipes :</strong> ${t.teamDetails.length} / ${t.maxParticipants}</p>
                <p><strong>Récompense :</strong> ${t.prize || 'Aucune'}</p>
                <hr>
                ${actionsHTML}
                <hr>
                ${teamsHTML}
                ${bracketHTML}
            `;

        } catch (error) {
            detailContainer.innerHTML = `<p class="error">Erreur: ${error.message}</p>`;
        }
    }

    // --- GESTION DES ÉVÉNEMENTS ---

    detailContainer.addEventListener('click', async (e) => {
        const target = e.target;
        
        if (target.matches('.create-team-btn')) {
            document.getElementById('team-tournament-id').value = target.dataset.tournamentId;
            createTeamModal.style.display = 'flex';
        }
        
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
                fetchAndRenderTournamentDetails();
            } catch (err) { alert(`Erreur: ${err.message}`); }
        }

        if (target.matches('.join-private-team-btn')) {
            document.getElementById('join-team-id').value = target.dataset.teamId;
            joinPrivateTeamModal.style.display = 'flex';
        }

        if (target.matches('.start-tournament-btn')) {
            if (!confirm("Voulez-vous vraiment lancer le tournoi ? L'arbre sera généré et les inscriptions fermées.")) return;
            try {
                const response = await fetch(`${API_URL}/tournaments/${target.dataset.tournamentId}/bracket`, { method: 'POST' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                alert(data.message);
                fetchAndRenderTournamentDetails();
            } catch (err) { alert(`Erreur: ${err.message}`); }
        }
    });

    createTeamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
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
            fetchAndRenderTournamentDetails();
        } catch (err) { alert(`Erreur: ${err.message}`); }
    });

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
            fetchAndRenderTournamentDetails();
        } catch (err) { alert(`Erreur: ${err.message}`); }
    });
    
    // --- GESTION DES MODALES ---

    isPrivateCheckbox.addEventListener('change', () => {
        joinCodeContainer.style.display = isPrivateCheckbox.checked ? 'block' : 'none';
    });
    
    [createTeamModal, joinPrivateTeamModal].forEach(modal => {
        if (!modal) return;
        const closeButton = modal.querySelector('.modal-close-button');
        if(closeButton) closeButton.addEventListener('click', () => modal.style.display = 'none');
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Lancer le fetch initial
    fetchAndRenderTournamentDetails();
});