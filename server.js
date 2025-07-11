const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = 3000;

// Ta clé d'API secrète de Supercell
const BRAWL_STARS_API_KEY = 'METS-TA-CLÉ-D-API-ICI'; 

// Middlewares
app.use(cors());
app.use(express.json());

app.post('/verify-player', async (req, res) => {
    const { playerTag } = req.body;

    if (!playerTag) {
        return res.status(400).json({ error: 'Le tag du joueur est manquant.' });
    }

    const formattedTag = playerTag.replace('#', '%23');
    const apiUrl = `https://api.brawlstars.com/v1/players/${formattedTag}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${BRAWL_STARS_API_KEY}`
            }
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
        
        const verificationBattle = battleLog.items.find(entry => {
            const battle = entry.battle;
            const playerInBattle = battle.players?.find(p => p.tag === playerTag);
            
            const isFriendlyGame = battle.type === 'friendly';
            const playedShelly = playerInBattle?.brawler.name === 'SHELLY';
            // ===== CORRECTION FINALE ICI =====
            const isCommunityMap = entry.event?.map === null;

            return isFriendlyGame && playedShelly && isCommunityMap;
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
            res.status(403).json({ error: "Action non vérifiée. Veuillez jouer une partie AMICALE avec Shelly sur une carte communautaire et réessayez." });
        }

    } catch (error) {
        console.error('Erreur interne lors de la vérification de l\'action:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});