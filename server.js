const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

// Middlewares pour autoriser les requêtes cross-origin et parser le JSON
app.use(cors());
app.use(express.json());

// Base de données en mémoire (pour la simplicité, remplacez par une vraie base de données en production)
const users = [];

/**
 * Endpoint pour l'inscription de nouveaux utilisateurs.
 * Prend un nom d'utilisateur et un mot de passe.
 */
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Vérifications simples
    if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    }

    // On vérifie si l'utilisateur existe déjà
    const userExists = users.find(user => user.username === username);
    if (userExists) {
        return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris.' });
    }

    // On sauvegarde le nouvel utilisateur
    const newUser = { username, password };
    users.push(newUser);
    console.log('Utilisateurs enregistrés:', users); // Pour le débogage

    // On retourne une réponse de succès
    res.status(201).json({ message: 'Compte créé avec succès ! Vous pouvez vous connecter.' });
});

/**
 * Endpoint pour la connexion des utilisateurs.
 * Vérifie le nom d'utilisateur et le mot de passe.
 */
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Vérifications simples
    if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    }

    // On cherche l'utilisateur et on vérifie son mot de passe
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' });
    }

    // Si la connexion réussit, on renvoie un message de succès et le nom d'utilisateur
    res.status(200).json({
        message: 'Connexion réussie !',
        username: user.username // On renvoie le pseudo pour le sauvegarder côté client
    });
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});