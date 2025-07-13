const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;
if (!uri) {
    throw new Error('La variable d\'environnement MONGO_URI est manquante.');
}

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let usersCollection;
let scrimsCollection;

async function run() {
  try {
    await client.connect();
    console.log("Connecté avec succès à MongoDB Atlas !");
    
    const database = client.db("brawlarenaDB");
    usersCollection = database.collection("users");
    scrimsCollection = database.collection("scrims");
    
    app.listen(port, () => {
        console.log(`Serveur Express démarré sur http://localhost:${port}`);
    });

  } catch (err) {
    console.error("Échec de la connexion à MongoDB", err);
    process.exit(1);
  }
}

run();

// ... Les routes pour les utilisateurs (/register, /login, etc.) sont inchangées ...
// ===============================================
//      ROUTES UTILISATEURS
// ===============================================
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    const userExists = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (userExists) return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris.' });
    const result = await usersCollection.insertOne({ username, password, isPremium: false });
    res.status(201).json({ message: 'Compte créé avec succès !' });
});
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    const user = await usersCollection.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' });
    res.status(200).json({ message: 'Connexion réussie !', username: user.username, isPremium: user.isPremium });
});
app.get('/users', async (req, res) => {
    const { requestingUser } = req.query;
    if (!requestingUser || requestingUser.trim().toLowerCase() !== 'brawlarena.gg') {
        return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
    }
    const users = await usersCollection.find({}, { projection: { username: 1, _id: 0 } }).toArray();
    res.status(200).json(users);
});
app.post('/premium/toggle', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Nom d'utilisateur manquant" });
    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    const newPremiumStatus = !user.isPremium;
    await usersCollection.updateOne({ username }, { $set: { isPremium: newPremiumStatus } });
    res.status(200).json({ username, isPremium: newPremiumStatus });
});
app.post('/users/statuses', async (req, res) => {
    try {
        const { usernames } = req.body;
        if (!usernames || !Array.isArray(usernames)) return res.status(400).json({ error: "Un tableau de noms d'utilisateurs est requis." });
        const users = await usersCollection.find({ username: { $in: usernames } }, { projection: { username: 1, isPremium: 1, _id: 0 } }).toArray();
        const statusMap = users.reduce((acc, user) => { acc[user.username] = user.isPremium; return acc; }, {});
        res.status(200).json(statusMap);
    } catch (error) { res.status(500).json({ error: "Erreur lors de la récupération des statuts." }); }
});


// ===============================================
//      ROUTES SCRIMS
// ===============================================

// ... (la route GET /scrims est inchangée)
app.get('/scrims', async (req, res) => {
    try {
        const allScrims = await scrimsCollection.find({}).sort({ eventDate: 1, startTime: 1 }).toArray();
        res.status(200).json(allScrims);
    } catch (error) {
        console.error("Erreur dans GET /scrims:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des scrims" });
    }
});


// NOUVELLE ROUTE : Suppression d'un scrim par l'administrateur
app.delete('/scrims/:id', async (req, res) => {
    const { requestingUser } = req.query;

    // Étape 1 : Vérifier si l'utilisateur est bien l'administrateur
    if (!requestingUser || requestingUser.trim().toLowerCase() !== 'brawlarena.gg') {
        return res.status(403).json({ error: 'Action non autorisée.' });
    }

    try {
        const scrimId = new ObjectId(req.params.id);
        
        // Étape 2 : Supprimer le scrim
        const result = await scrimsCollection.deleteOne({ _id: scrimId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Scrim non trouvé.' });
        }

        res.status(200).json({ message: 'Scrim supprimé avec succès.' });

    } catch (error) {
        res.status(400).json({ error: 'ID de scrim invalide' });
    }
});


// ... (les autres routes /post, /join, etc. sont inchangées)
app.post('/scrims', async (req, res) => {
    const scrimData = { ...req.body, players: [req.body.creator] };
    const result = await scrimsCollection.insertOne(scrimData);
    res.status(201).json({ ...scrimData, _id: result.insertedId });
});
app.post('/scrims/:id/join', async (req, res) => {
    try {
        const scrimId = new ObjectId(req.params.id);
        const { username } = req.body;
        const scrim = await scrimsCollection.findOne({ _id: scrimId });
        if (!scrim) return res.status(404).json({ error: 'Scrim non trouvé.' });
        if (scrim.players.length >= 6) return res.status(400).json({ error: 'Le scrim est déjà plein.' });
        if (scrim.players.includes(username)) return res.status(400).json({ error: 'Vous êtes déjà dans ce scrim.' });
        await scrimsCollection.updateOne({ _id: scrimId }, { $push: { players: username } });
        res.status(200).json({ message: 'Rejoint avec succès' });
    } catch (error) { res.status(400).json({ error: 'ID de scrim invalide' }); }
});
app.post('/scrims/:id/leave', async (req, res) => {
    try {
        const scrimId = new ObjectId(req.params.id);
        const { username } = req.body;
        const scrim = await scrimsCollection.findOne({ _id: scrimId });
        if (!scrim) return res.status(404).json({ error: 'Scrim non trouvé.' });
        if (scrim.creator === username) { await scrimsCollection.deleteOne({ _id: scrimId });
        } else { await scrimsCollection.updateOne({ _id: scrimId }, { $pull: { players: username } }); }
        res.status(200).json({ message: 'Action effectuée avec succès.' });
    } catch (error) { res.status(400).json({ error: 'ID de scrim invalide' }); }
});
app.patch('/scrims/:id/gameid', async (req, res) => {
    try {
        const scrimId = new ObjectId(req.params.id);
        const { gameId } = req.body;
        const result = await scrimsCollection.updateOne({ _id: scrimId }, { $set: { gameId: gameId } });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Scrim non trouvé.' });
        res.status(200).json({ message: 'ID mis à jour' });
    } catch (error) { res.status(400).json({ error: 'ID de scrim invalide' }); }
});