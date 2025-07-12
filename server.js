const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = 3000;

// Pensez à remplacer ceci par votre clé API
const BRAWL_STARS_API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjVkNDJmNGFmLTFjMjMtNDdjMy1iZGFkLTdmZDExZTc4ZDlhZSIsImlhdCI6MTc1MjI1OTkyMSwic3ViIjoiZGV2ZWxvcGVyLzNhOTgxOGVkLTEwNGEtM2ViNS04ZWQwLWRmZDEyNmQ3ZjZmOCIsInNjb3BlcyI6WyJicmF3bHN0YXJzIl0sImxpbWl0cyI6W3sidGllciI6ImRldmVsb3Blci9zaWx2ZXIiLCJ0eXBlIjoidGhyb3R0bGluZyJ9LHsiY2lkcnMiOlsiNDQuMjI2LjE0NS4yMTMiLCI1NC4xODcuMjAwLjI1NSIsIjM0LjIxMy4yMTQuNTUiLCIzNS4xNjQuOTUuMTU2IiwiNDQuMjMwLjk1LjE4MyJdLCJ0eXBlIjoiY2xpZW50In1dfQ.51DaRe_Tw2h6my3o1tK2IP5fhc2eRXSZCQLlLBwikohR-bQoBP4tBLr6yxECerw0Y5KPqD0vzSolXZFn_mqNMg'; 

// Middlewares
app.use(cors());
app.use(express.json());

// L'inscription ne change pas
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

// ===== NOUVELLE LOGIQUE DE CONNEXION SIMPLIFIÉE =====
app.post('/login', async (req, res) => {
    const { playerTag } = req.body;
    if (!playerTag) {
        return res.status(400).json({ error: 'Le tag du joueur est manquant.' });
    }
    const formattedTag = playerTag.replace('#', '%23');
    const playerInfoUrl = `https://api.brawlstars.com/v1/players/${formattedTag}`;
    try {
        // On vérifie simplement que le joueur existe
        const playerInfoResponse = await fetch(playerInfoUrl, {
            headers: { 'Authorization': `Bearer ${BRAWL_STARS_API_KEY}` }
        });

        // Si le tag est invalide ou la clé API mauvaise, on renvoie une erreur
        if (!playerInfoResponse.ok) {
            return res.status(playerInfoResponse.status).json({ error: 'Connexion impossible. Le tag est-il correct ?' });
        }

        const playerData = await playerInfoResponse.json();

        // Si tout va bien, la connexion est réussie
        res.status(200).json({
            message: 'Connexion réussie !',
            player: {
                name: playerData.name,
                tag: playerData.tag
            }
        });

    } catch (error) {
        console.error('Erreur interne lors de la connexion:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});