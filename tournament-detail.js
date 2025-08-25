document.addEventListener('DOMContentLoaded', () => {
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    const API_URL = 'https://brawlarena-gg.onrender.com';
    const detailContainer = document.getElementById('tournament-detail-container');
    let currentTournamentData = null; // Stocker les données du tournoi

    // --- SÉLECTION DES ÉLÉMENTS MODALS ---
    const createTeamModal = document.getElementById('create-team-modal');
    const joinPrivateTeamModal = document.getElementById('join-private-team-modal');
    const createTeamForm = document.getElementById('create-team-form');
    const joinPrivateTeamForm = document.getElementById('join-private-team-form');
    const isPrivateCheckbox = document.getElementById('team-is-private');
    const joinCodeContainer = document.getElementById('team-join-code-container');

    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id');

    if (!tournamentId) {
        detailContainer.innerHTML = '<p class="error">Aucun ID de tournoi fourni. <a href="tournaments.html">Retour à la liste</a>.</p>';
        return;
    }

    // --- FONCTIONS DE RENDU POUR CHAQUE SECTION ---

    function renderDetailsSection(t) {
        const contentDiv = document.getElementById('tournament-detail-content');
        if (!contentDiv) return;

        const userTeam = t.teamDetails.find(team => team.members.includes(loggedInUsername));
        const isTournamentFull = t.teamDetails.length >= t.maxParticipants;
        const isTournamentStarted = t.status === 'Ongoing' || t.status === 'Finished';
        const canBeStarted = new Date(t.dateTime) < new Date() && !t.bracket;

        // --- Section Admin pour l'organisateur ---
        let adminZoneHTML = '';
        if (t.creator === loggedInUsername && canBeStarted) {
            adminZoneHTML = `
                <div class="detail-card admin-zone">
                    <h3>Zone Admin</h3>
                    <p>En tant qu'organisateur, vous pouvez lancer le tournoi. Cette action est irréversible.</p>
                    <button class="button start-tournament-btn" data-tournament-id="${t._id}">Lancer le Tournoi</button>
                </div>
            `;
        }

        // --- Actions pour les joueurs ---
        let playerActionsHTML = '';
        if (!isTournamentStarted) {
            if (!userTeam && !isTournamentFull) {
                playerActionsHTML = `<button class="button create-team-btn" data-tournament-id="${t._id}">Créer une Équipe</button>`;
            } else if (userTeam) {
                playerActionsHTML = `<p style="color:var(--success-color); margin: 0;">Vous êtes dans l'équipe : ${userTeam.name}</p>`;
            } else if (isTournamentFull) {
                playerActionsHTML = `<p style="color:var(--text-dark); margin: 0;">Tournoi complet</p>`;
            }
        }

        contentDiv.innerHTML = `
            <div class="tournament-grid">
                <div class="detail-card">
                    <h3>Informations</h3>
                    <p><strong>Organisateur :</strong> ${t.creator}</p>
                    <p><strong>Date :</strong> ${new Date(t.dateTime).toLocaleString('fr-FR')}</p>
                    <p><strong>Format :</strong> ${t.format}</p>
                    <p><strong>Récompense :</strong> ${t.prize || 'Aucune'}</p>
                </div>
                <div class="detail-card">
                    <h3>Statut</h3>
                    <p><strong>État :</strong> ${t.status}</p>
                    <p><strong>Équipes inscrites :</strong> ${t.teamDetails.length} / ${t.maxParticipants}</p>
                </div>
                <div class="detail-card">
                    <h3>Actions</h3>
                    <div class="scrim-actions">
                        ${playerActionsHTML || '<p style="margin:0; color:var(--text-dark);">Les inscriptions sont fermées.</p>'}
                    </div>
                </div>
                ${adminZoneHTML}
            </div>
        `;
    }

    function renderTeamsSection(t) {
        const contentDiv = document.getElementById('tournament-detail-content');
        if (!contentDiv) return;

        const userTeam = t.teamDetails.find(team => team.members.includes(loggedInUsername));
        const isTournamentStarted = t.status === 'Ongoing' || t.status === 'Finished';
        
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
            teamsHTML += '<p>Aucune équipe inscrite pour le moment.</p>';
        }
        teamsHTML += '</div>';
        contentDiv.innerHTML = teamsHTML;
    }

    function renderBracketSection(t) {
        const contentDiv = document.getElementById('tournament-detail-content');
        if (!contentDiv) return;

        let bracketHTML = '';
        if ((t.status === 'Ongoing' || t.status === 'Finished') && t.bracket) {
            bracketHTML += '<div id="bracket-container" class="bracket-container">';
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
        } else {
            bracketHTML = "<p>L'arbre du tournoi n'est pas encore disponible. Il sera généré une fois le tournoi lancé par l'organisateur.</p>";
        }
        contentDiv.innerHTML = bracketHTML;
    }

    async function fetchAndRenderTournamentDetails() {
        try {
            detailContainer.innerHTML = '<p>Chargement des détails du tournoi...</p>';
            const response = await fetch(`${API_URL}/tournaments/${tournamentId}`);

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Tournoi non trouvé.');
            }
            
            currentTournamentData = await response.json();

            detailContainer.innerHTML = `
                <div class="tournament-header">
                    <h1>${currentTournamentData.name}</h1>
                </div>
                <div class="tournament-detail-nav">
                    <button class="nav-button active" data-section="details">Détails</button>
                    <button class="nav-button" data-section="teams">Équipes</button>
                    <button class="nav-button" data-section="bracket">Bracket</button>
                </div>
                <div id="tournament-detail-content"></div>
            `;
            
            renderDetailsSection(currentTournamentData);

        } catch (error) {
            detailContainer.innerHTML = `<p class="error">Erreur: ${error.message}</p>`;
        }
    }

    // --- GESTION DES ÉVÉNEMENTS ---
    detailContainer.addEventListener('click', async (e) => {
        const target = e.target;
        
        if (target.matches('.nav-button')) {
            const section = target.dataset.section;
            detailContainer.querySelector('.nav-button.active').classList.remove('active');
            target.classList.add('active');

            if (section === 'details') renderDetailsSection(currentTournamentData);
            else if (section === 'teams') renderTeamsSection(currentTournamentData);
            else if (section === 'bracket') renderBracketSection(currentTournamentData);
            return;
        }
        
        if (target.matches('.create-team-btn')) {
            document.getElementById('team-tournament-id').value = currentTournamentData._id;
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

    fetchAndRenderTournamentDetails();
});