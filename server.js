const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// --- BASES DE DONNÉES EN MÉMOIRE ---
const users = [];
const scrims = []; // On stocke les scrims ici maintenant !

// ===============================================
//      ROUTES POUR LES UTILISATEURS (INCHANGÉ)
// ===============================================
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    }
    const userExists = users.find(user => user.username === username);
    if (userExists) {
        return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris.' });
    }
    const newUser = { username, password };
    users.push(newUser);
    res.status(201).json({ message: 'Compte créé avec succès ! Vous pouvez vous connecter.' });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    }
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' });
    }
    res.status(200).json({
        message: 'Connexion réussie !',
        username: user.username
    });
});

// ===============================================
//      NOUVELLES ROUTES POUR LES SCRIMS
// ===============================================

// Obtenir la liste de tous les scrims
app.get('/scrims', (req, res) => {
    // On peut ajouter une logique pour nettoyer les vieux scrims ici si besoin
    res.status(200).json(scrims);
});

// Créer un nouveau scrim
app.post('/scrims', (req, res) => {
    const newScrim = {
        id: Date.now(),
        creator: req.body.creator,
        eventDate: req.body.eventDate,
        roomName: req.body.roomName,
        gameId: req.body.gameId,
        avgRank: req.body.avgRank,
        startTime: req.body.startTime,
        players: [req.body.creator] // Le créateur rejoint automatiquement
    };
    scrims.push(newScrim);
    res.status(201).json(newScrim);
});

// Rejoindre un scrim
app.post('/scrims/:id/join', (req, res) => {
    const scrim = scrims.find(s => s.id == req.params.id);
    const { username } = req.body;

    if (!scrim) {
        return res.status(404).json({ error: 'Scrim non trouvé.' });
    }
    if (scrim.players.length >= 6) {
        return res.status(400).json({ error: 'Le scrim est déjà plein.' });
    }
    if (scrim.players.includes(username)) {
        return res.status(400).json({ error: 'Vous êtes déjà dans ce scrim.' });
    }

    scrim.players.push(username);
    res.status(200).json(scrim);
});

// Quitter ou supprimer un scrim
app.post('/scrims/:id/leave', (req, res) => {
    const scrimId = parseInt(req.params.id, 10);
    const { username } = req.body;
    const scrimIndex = scrims.findIndex(s => s.id === scrimId);

    if (scrimIndex === -1) {
        return res.status(404).json({ error: 'Scrim non trouvé.' });
    }

    const scrim = scrims[scrimIndex];
    if (scrim.creator === username) {
        // Si le créateur quitte, le scrim est supprimé
        scrims.splice(scrimIndex, 1);
        res.status(200).json({ message: 'Scrim supprimé.' });
    } else {
        // Sinon, seul le joueur est retiré
        scrim.players = scrim.players.filter(p => p !== username);
        res.status(200).json(scrim);
    }
});

// Mettre à jour l'ID de la partie
app.patch('/scrims/:id/gameid', (req, res) => {
    const scrim = scrims.find(s => s.id == req.params.id);
    const { gameId } = req.body;

    if (!scrim) {
        return res.status(404).json({ error: 'Scrim non trouvé.' });
    }
    
    scrim.gameId = gameId;
    res.status(200).json(scrim);
});


app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});