const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Récupération de la chaîne de connexion depuis les variables d'environnement
const uri = process.env.MONGO_URI;
if (!uri) {
    throw new Error('La variable d\'environnement MONGO_URI est manquante.');
}

// Création du client MongoDB
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let usersCollection;
let scrimsCollection;

// Fonction pour se connecter à la base de données et démarrer le serveur
async function run() {
  try {
    // Connexion au client
    await client.connect();
    console.log("Connecté avec succès à MongoDB Atlas !");
    
    // Sélection de la base de données et des collections
    const database = client.db("brawlarenaDB"); // Vous pouvez nommer votre DB comme vous voulez
    usersCollection = database.collection("users");
    scrimsCollection = database.collection("scrims");
    
    // Démarrage du serveur Express une fois la connexion établie
    app.listen(port, () => {
        console.log(`Serveur Express démarré sur http://localhost:${port}`);
    });

  } catch (err) {
    console.error("Échec de la connexion à MongoDB", err);
    process.exit(1);
  }
}

// Lancement de la fonction de connexion
run();


// ===============================================
//      ROUTES (maintenant asynchrones)
// ===============================================

// --- Utilisateurs ---
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    
    // Recherche insensible à la casse
    const userExists = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (userExists) return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris.' });

    const result = await usersCollection.insertOne({ username, password });
    res.status(201).json({ message: 'Compte créé avec succès !', userId: result.insertedId });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });

    const user = await usersCollection.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' });

    res.status(200).json({ message: 'Connexion réussie !', username: user.username });
});

app.get('/users', async (req, res) => {
    const { requestingUser } = req.query;
    if (!requestingUser || requestingUser.trim().toLowerCase() !== 'brawlarena.gg') {
        return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
    }
    // Projette uniquement le champ 'username' et exclut '_id'
    const users = await usersCollection.find({}, { projection: { username: 1, _id: 0 } }).toArray();
    res.status(200).json(users);
});


// --- Scrims ---
app.get('/scrims', async (req, res) => {
    const allScrims = await scrimsCollection.find({}).sort({ eventDate: 1, startTime: 1 }).toArray();
    res.status(200).json(allScrims);
});

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
    } catch (error) {
        res.status(400).json({ error: 'ID de scrim invalide' });
    }
});

app.post('/scrims/:id/leave', async (req, res) => {
    try {
        const scrimId = new ObjectId(req.params.id);
        const { username } = req.body;

        const scrim = await scrimsCollection.findOne({ _id: scrimId });
        if (!scrim) return res.status(404).json({ error: 'Scrim non trouvé.' });

        if (scrim.creator === username) {
            await scrimsCollection.deleteOne({ _id: scrimId });
        } else {
            await scrimsCollection.updateOne({ _id: scrimId }, { $pull: { players: username } });
        }
        res.status(200).json({ message: 'Action effectuée avec succès.' });
    } catch (error) {
        res.status(400).json({ error: 'ID de scrim invalide' });
    }
});

app.patch('/scrims/:id/gameid', async (req, res) => {
    try {
        const scrimId = new ObjectId(req.params.id);
        const { gameId } = req.body;

        const result = await scrimsCollection.updateOne({ _id: scrimId }, { $set: { gameId: gameId } });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Scrim non trouvé.' });
        
        res.status(200).json({ message: 'ID mis à jour' });
    } catch (error) {
        res.status(400).json({ error: 'ID de scrim invalide' });
    }
});