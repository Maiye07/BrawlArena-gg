const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());

app.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(400).send('Webhook secret not configured.');
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.log(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const username = session.metadata.username;
        if (username) {
            console.log(`Paiement réussi pour: ${username}. Mise à jour du statut premium.`);
            await usersCollection.updateOne({ username: username }, { $set: { isPremium: true } });
        }
    }
    res.status(200).json({ received: true });
});

app.use(express.json());
app.use(express.static(__dirname)); // Pour servir les fichiers statiques depuis la racine

const uri = process.env.MONGO_URI;
if (!uri) throw new Error('La variable d\'environnement MONGO_URI est manquante.');

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
//      ROUTES API
// ===============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Utilisateurs ---
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });

    // AJOUT : Validation du format du nom d'utilisateur
    const validUsernameRegex = /^[A-Za-z0-9]+$/;
    if (!validUsernameRegex.test(username)) {
        return res.status(400).json({ error: 'Pseudo invalide.' });
    }
    
    const userExists = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (userExists) return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris.' });

    const newUser = { username, password, isPremium: false, dailyScrims: 0, lastActivityDate: new Date().toISOString().split('T')[0] };
    await usersCollection.insertOne(newUser);
    res.status(201).json({ message: 'Compte créé avec succès !' });
});

// ... (le reste des routes est inchangé)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    const user = await usersCollection.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' });
    res.status(200).json({ 
        message: 'Connexion réussie !', 
        username: user.username,
        isPremium: user.isPremium,
        dailyScrims: user.dailyScrims || 0,
        lastActivityDate: user.lastActivityDate
    });
});
app.get('/users', async (req, res) => {
    const { requestingUser } = req.query;
    if (!requestingUser || requestingUser.trim().toLowerCase() !== 'brawlarena.gg') { return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' }); }
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
        if (!usernames || !Array.isArray(usernames)) { return res.status(400).json({ error: "Un tableau de noms d'utilisateurs est requis." }); }
        const users = await usersCollection.find({ username: { $in: usernames } },{ projection: { username: 1, isPremium: 1, _id: 0 } }).toArray();
        const statusMap = users.reduce((acc, user) => { acc[user.username] = user.isPremium; return acc; }, {});
        res.status(200).json(statusMap);
    } catch (error) { res.status(500).json({ error: "Erreur lors de la récupération des statuts." }); }
});
app.post('/create-checkout-session', async (req, res) => {
    const { username } = req.body;
    const appUrl = process.env.YOUR_APP_URL || 'http://localhost:5500';
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [{
                price_data: { currency: 'eur', product_data: { name: 'BrawlArena.gg - Membre Premium' }, unit_amount: 500, },
                quantity: 1,
            }],
            metadata: { username: username },
            success_url: `${appUrl}/dashboard.html?payment=success`,
            cancel_url: `${appUrl}/dashboard.html?payment=cancel`,
        });
        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Erreur de création de session Stripe:", error);
        res.status(500).json({ error: "Impossible de lancer le paiement." });
    }
});

// --- Scrims ---
app.post('/scrims', async (req, res) => {
    const { creator, roomName, gameId, avgRank, startsInMinutes } = req.body;
    if (!creator || !roomName || !avgRank || startsInMinutes === undefined) { return res.status(400).json({ error: "Informations manquantes pour la création du scrim." }); }
    if (startsInMinutes <= 0 || startsInMinutes > 2880) { return res.status(400).json({ error: "La durée doit être comprise entre 1 minute et 48 heures." }); }
    const user = await usersCollection.findOne({ username: creator });
    if (!user) return res.status(404).json({ error: "Utilisateur créateur non trouvé." });
    const today = new Date().toISOString().split('T')[0];
    let dailyScrims = user.dailyScrims || 0;
    if (user.lastActivityDate !== today) { dailyScrims = 0; }
    if (!user.isPremium && dailyScrims >= 2) { return res.status(403).json({ error: "Limite journalière de création de scrims atteinte." }); }
    const startTime = new Date(Date.now() + startsInMinutes * 60 * 1000);
    const scrimData = { creator, roomName, gameId, avgRank, startTime, players: [creator] };
    const result = await scrimsCollection.insertOne(scrimData);
    await usersCollection.updateOne({ _id: user._id }, { $set: { lastActivityDate: today }, $inc: { dailyScrims: 1 } });
    res.status(201).json({ ...scrimData, _id: result.insertedId });
});
app.get('/scrims', async (req, res) => {
    try {
        const allScrims = await scrimsCollection.find({}).sort({ startTime: 1 }).toArray();
        res.status(200).json(allScrims);
    } catch (error) {
        console.error("Erreur dans GET /scrims:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des scrims" });
    }
});
app.delete('/scrims/:id', async (req, res) => {
    const { requestingUser } = req.query;
    if (!requestingUser || requestingUser.trim().toLowerCase() !== 'brawlarena.gg') { return res.status(403).json({ error: 'Action non autorisée.' }); }
    try {
        const scrimId = new ObjectId(req.params.id);
        const result = await scrimsCollection.deleteOne({ _id: scrimId });
        if (result.deletedCount === 0) { return res.status(404).json({ error: 'Scrim non trouvé.' }); }
        res.status(200).json({ message: 'Scrim supprimé avec succès.' });
    } catch (error) { res.status(400).json({ error: 'ID de scrim invalide' }); }
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