const express = require('express');
const cors = require('cors');
const fs = require('fs'); // Importer le module File System de Node.js

const app = express();
const port = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// --- CHEMINS DES FICHIERS DE SAUVEGARDE ---
const USERS_FILE = 'users.json';
const SCRIMS_FILE = 'scrims.json';

// --- FONCTION POUR CHARGER LES DONNÉES DEPUIS UN FICHIER ---
const loadData = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error(`Erreur lors du chargement du fichier ${filePath}:`, error);
        return [];
    }
};

// --- BASES DE DONNÉES, INITIALISÉES AVEC LES DONNÉES DES FICHIERS ---
let users = loadData(USERS_FILE);
let scrims = loadData(SCRIMS_FILE);

// --- FONCTIONS POUR SAUVEGARDER LES DONNÉES ---
const saveUsers = () => {
    fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), (err) => {
        if (err) console.error('Erreur lors de la sauvegarde des utilisateurs:', err);
    });
};

const saveScrims = () => {
    fs.writeFile(SCRIMS_FILE, JSON.stringify(scrims, null, 2), (err) => {
        if (err) console.error('Erreur lors de la sauvegarde des scrims:', err);
    });
};

// ===============================================
//      ROUTES POUR LES UTILISATEURS
// ===============================================
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    }

    const userExists = users.find(user => user.username.toLowerCase() === username.toLowerCase());
    if (userExists) {
        return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris.' });
    }

    const newUser = { username, password };
    users.push(newUser);
    saveUsers();
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

app.get('/users', (req, res) => {
    const { requestingUser } = req.query;

    if (requestingUser !== 'BrawlArena.gg') {
        return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
    }

    const sanitizedUsers = users.map(user => ({ username: user.username }));
    res.status(200).json(sanitizedUsers);
});

// ===============================================
//      ROUTES POUR LES SCRIMS
// ===============================================

app.get('/scrims', (req, res) => {
    res.status(200).json(scrims);
});

app.post('/scrims', (req, res) => {
    const newScrim = {
        id: Date.now(),
        creator: req.body.creator,
        eventDate: req.body.eventDate,
        roomName: req.body.roomName,
        gameId: req.body.gameId,
        avgRank: req.body.avgRank,
        startTime: req.body.startTime,
        players: [req.body.creator]
    };
    scrims.push(newScrim);
    saveScrims();
    res.status(201).json(newScrim);
});

app.post('/scrims/:id/join', (req, res) => {
    const scrim = scrims.find(s => s.id == req.params.id);
    const { username } = req.body;

    if (!scrim) return res.status(404).json({ error: 'Scrim non trouvé.' });
    if (scrim.players.length >= 6) return res.status(400).json({ error: 'Le scrim est déjà plein.' });
    if (scrim.players.includes(username)) return res.status(400).json({ error: 'Vous êtes déjà dans ce scrim.' });

    scrim.players.push(username);
    saveScrims();
    res.status(200).json(scrim);
});

app.post('/scrims/:id/leave', (req, res) => {
    const scrimId = parseInt(req.params.id, 10);
    const { username } = req.body;
    const scrimIndex = scrims.findIndex(s => s.id === scrimId);

    if (scrimIndex === -1) return res.status(404).json({ error: 'Scrim non trouvé.' });

    const scrim = scrims[scrimIndex];
    if (scrim.creator === username) {
        scrims.splice(scrimIndex, 1);
    } else {
        scrim.players = scrim.players.filter(p => p !== username);
    }
    saveScrims();
    res.status(200).json({ message: 'Action effectuée avec succès.' });
});

app.patch('/scrims/:id/gameid', (req, res) => {
    const scrim = scrims.find(s => s.id == req.params.id);
    const { gameId } = req.body;

    if (!scrim) return res.status(404).json({ error: 'Scrim non trouvé.' });

    scrim.gameId = gameId;
    saveScrims();
    res.status(200).json(scrim);
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});