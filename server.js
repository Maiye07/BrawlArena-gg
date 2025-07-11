const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = 3000;

// Votre clé d'API secrète de Supercell
const BRAWL_STARS_API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjVkNDJmNGFmLTFjMjMtNDdjMy1iZGFkLTdmZDExZTc4ZDlhZSIsImlhdCI6MTc1MjI1OTkyMSwic3ViIjoiZGV2ZWxvcGVyLzNhOTgxOGVkLTEwNGEtM2ViNS04ZWQwLWRmZDEyNmQ3ZjZmOCIsInNjb3BlcyI6WyJicmF3bHN0YXJzIl0sImxpbWl0cyI6W3sidGllciI6ImRldmVsb3Blci9zaWx2ZXIiLCJ0eXBlIjoidGhyb3R0bGluZyJ9LHsiY2lkcnMiOlsiNDQuMjI2LjE0NS4yMTMiLCI1NC4xODcuMjAwLjI1NSIsIjM0LjIxMy4yMTQuNTUiLCIzNS4xNjQuOTUuMTU2IiwiNDQuMjMwLjk1LjE4MyJdLCJ0eXBlIjoiY2xpZW50In1dfQ.51DaRe_Tw2h6my3o1tK2IP5fhc2eRXSZCQLlLBwikohR-bQoBP4tBLr6yxECerw0Y5KPqD0vzSolXZFn_mqNMg'; 

// Middlewares
app.use(cors());
app.use(express.json());

// Endpoint pour l'inscription (inchangé)
app.post('/verify-player', async (req, res) => {
    const { playerTag } = req.body;
    if (!playerTag) {
        return res.status(400).json({ error: 'Le tag du joueur est manquant.' });
    }
    const formattedTag = playerTag.replace('#', '%23');
    const apiUrl = `https://api.brawlstars.com/v1/players/${formattedTag}`;
    try {
        const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${BRAWL_STARS_API_KEY}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ error: 'Tag de joueur invalide ou introuvable.', details: errorData });
        }
        const playerData = await response.json();
        res.status(200).json({
            name: playerData.name,
            tag: playerData.tag
        });
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API Brawl Stars:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
});

// Endpoint pour la connexion (logique simplifiée)
app.post('/login-by-action', async (req, res) => {
    const { playerTag } = req.body;
    if (!playerTag) {
        return res.status(400).json({ error: 'Le tag du joueur est manquant.' });
    }
    const formattedTag = playerTag.replace('#', '%23');
    const battleLogUrl = `https://api.brawlstars.com/v1/players/${formattedTag}/battlelog`;
    const playerInfoUrl = `https://api.brawlstars.com/v1/players/${formattedTag}`;
    try {
        const battleLogResponse = await fetch(battleLogUrl, {
            headers: { 'Authorization': `Bearer ${BRAWL_STARS_API_KEY}` }
        });
        if (!battleLogResponse.ok) {
            return res.status(battleLogResponse.status).json({ error: 'Impossible de récupérer le journal de combats. Le tag est-il correct ?' });
        }
        const battleLog = await battleLogResponse.json();
        
        // ===== LOGIQUE DE VÉRIFICATION SIMPLIFIÉE ICI =====
        const verificationBattle = battleLog.items.find(entry => {
            const battle = entry.battle;
            const playerInBattle = battle.players?.find(p => p.tag === playerTag);
            
            const isFriendlyGame = battle.type === 'friendly';
            const playedShelly = playerInBattle?.brawler?.name === 'SHELLY';

            // On ne vérifie plus la carte, juste ces deux conditions
            return isFriendlyGame && playedShelly;
        });

        if (verificationBattle) {
            const playerInfoResponse = await fetch(playerInfoUrl, {
                headers: { 'Authorization': `Bearer ${BRAWL_STARS_API_KEY}` }
            });
            const playerData = await playerInfoResponse.json();
            res.status(200).json({
                message: 'Vérification réussie ! Connexion en cours...',
                player: {
                    name: playerData.name,
                    tag: playerData.tag
                }
            });
        } else {
            res.status(403).json({ error: "Action non vérifiée. Veuillez jouer une partie AMICALE avec Shelly et réessayez." });
        }
    } catch (error) {
        console.error('Erreur interne lors de la vérification de l\'action:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});