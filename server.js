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

// ===============================================
//      ROUTES UTILISATEURS
// ===============================================
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    
    const userExists = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (userExists) return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris.' });

    // On ajoute le statut premium par défaut
    const result = await usersCollection.insertOne({ username, password, isPremium: false });
    res.status(201).json({ message: 'Compte créé avec succès !' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });

    const user = await usersCollection.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' });
    
    // On renvoie aussi le statut premium de l'utilisateur
    res.status(200).json({ 
        message: 'Connexion réussie !', 
        username: user.username,
        isPremium: user.isPremium // Ajout de cette ligne
    });
});

app.get('/users', async (req, res) => {
    // ... (inchangé)
    const { requestingUser } = req.query;
    if (!requestingUser || requestingUser.trim().toLowerCase() !== 'brawlarena.gg') {
        return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
    }
    const users = await usersCollection.find({}, { projection: { username: 1, _id: 0 } }).toArray();
    res.status(200).json(users);
});


// NOUVELLE ROUTE POUR GÉRER LE STATUT PREMIUM
app.post('/premium/toggle', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Nom d'utilisateur manquant" });

    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    
    const newPremiumStatus = !user.isPremium;
    await usersCollection.updateOne({ username }, { $set: { isPremium: newPremiumStatus } });
    
    res.status(200).json({ username, isPremium: newPremiumStatus });
});


// ===============================================
//      ROUTES SCRIMS
// ===============================================

// ROUTE MODIFIÉE POUR INCLURE LES DONNÉES PREMIUM
app.get('/scrims', async (req, res) => {
    try {
        const results = await scrimsCollection.aggregate([
            {
                // Jointure avec la collection 'users'
                $lookup: {
                    from: "users",
                    localField: "players",
                    foreignField: "username",
                    as: "playerData"
                }
            },
            {
                // Création d'un champ qui mappe chaque joueur à son statut premium
                $addFields: {
                    premiumStatus: {
                        $arrayToObject: {
                            $map: {
                                input: "$playerData",
                                as: "player",
                                in: { 
                                    k: "$$player.username", 
                                    v: "$$player.isPremium" 
                                }
                            }
                        }
                    }
                }
            },
            {
                // On ne garde que les champs nécessaires pour ne pas surcharger la réponse
                $project: {
                    playerData: 0 
                }
            }
        ]).toArray();
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des scrims" });
    }
});


// --- Les autres routes de scrims restent globalement les mêmes ---
app.post('/scrims', async (req, res) => {
    const scrimData = { ...req.body, players: [req.body.creator] };
    const result = await scrimsCollection.insertOne(scrimData);
    res.status(201).json({ ...scrimData, _id: result.insertedId });
});
// ... (les routes /join, /leave, /gameid sont inchangées)
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