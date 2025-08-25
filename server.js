const express = require('express');
const cors = require('cors');
// MODIFICATION : ObjectId est requis pour la rétrocompatibilité et pour les autres collections.
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());

// Webhook Stripe doit être avant express.json()
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
            console.log(`Paiement réussi pour: ${username}. Mise à jour du statut premium et des objets.`);
            await usersCollection.updateOne(
                { username: username },
                {
                    $set: { isPremium: true },
                    $addToSet: {
                        unlockedColors: { $each: ['premium-gradient', 'supporter-gold'] },
                        unlockedBadges: { $each: ['premium', 'supporter-gold'] }
                    }
                }
            );
        }
    }
    res.status(200).json({ received: true });
});

app.use(express.json());


const uri = process.env.MONGO_URI;
if (!uri) throw new Error('La variable d\'environnement MONGO_URI est manquante.');

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let usersCollection;
let scrimsCollection;
let tournamentsCollection;
let teamsCollection;

async function run() {
  try {
    await client.connect();
    console.log("Connecté avec succès à MongoDB Atlas !");
    const database = client.db("brawlarenaDB");
    usersCollection = database.collection("users");
    scrimsCollection = database.collection("scrims");
    tournamentsCollection = database.collection("tournaments");
    teamsCollection = database.collection("teams");
    app.listen(port, () => {
        console.log(`Serveur Express démarré sur http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Échec de la connexion à MongoDB", err);
    process.exit(1);
  }
}
run();

// MODIFICATION : Ajout de la fonction pour obtenir le prochain ID de la séquence
async function getNextSequenceValue(sequenceName) {
   const sequenceDocument = await client.db("brawlarenaDB").collection("counters").findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { sequence_value: 1 } },
      { returnDocument: "after", upsert: true } // CORRECTION APPLIQUÉE ICI
   );
   // Avec upsert: true, sequenceDocument ne sera jamais null.
   // La première fois, il créera le document avec sequence_value: 1.
   return sequenceDocument.sequence_value;
}


// ===============================================
//      MIDDLEWARE DE SÉCURITÉ (AMÉLIORÉ)
// ===============================================
const isAdmin = (req, res, next) => {
    const requestingUser = req.body.requestingUser || req.query.requestingUser;
    if (requestingUser && requestingUser.toLowerCase() === 'brawlarena.gg') {
        next();
    } else {
        res.status(403).json({ error: 'Accès non autorisé.' });
    }
};

// =================================================================
//      ROUTES API (DOIVENT ÊTRE DÉCLARÉES AVANT app.use(express.static))
// =================================================================

// --- Utilisateurs ---
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });

    const validUsernameRegex = /^[A-Za-z0-9.]+$/;
    if (!validUsernameRegex.test(username)) {
        return res.status(400).json({ error: 'Pseudo invalide. Seuls les lettres, chiffres et points sont autorisés.' });
    }

    const userExists = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (userExists) return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris.' });

    const newUser = {
        username,
        password,
        isPremium: false,
        dailyScrims: 0,
        lastActivityDate: new Date().toISOString().split('T')[0],
        dailyTournaments: 0,
        lastTournamentDate: null,
        isBannedPermanently: false,
        banExpiresAt: null,
        activeColor: 'default',
        activeBadge: 'none',
        unlockedColors: ['default'],
        unlockedBadges: ['none']
    };
    await usersCollection.insertOne(newUser);
    res.status(201).json({ message: 'Compte créé avec succès !' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    const user = await usersCollection.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' });

    if (user.isBannedPermanently) {
        return res.status(403).json({ error: 'Ce compte a été banni de façon permanente.' });
    }
    if (user.banExpiresAt && new Date(user.banExpiresAt) > new Date()) {
        const expiryDate = new Date(user.banExpiresAt).toLocaleString('fr-FR');
        return res.status(403).json({ error: `Ce compte est banni temporairement jusqu'au ${expiryDate}.` });
    }

    const today = new Date().toISOString().split('T')[0];
    const userDailyStats = {
        dailyScrims: user.lastActivityDate === today ? (user.dailyScrims || 0) : 0,
        lastActivityDate: user.lastActivityDate,
        dailyTournaments: user.lastTournamentDate === today ? (user.dailyTournaments || 0) : 0,
        lastTournamentDate: user.lastTournamentDate
    };

    res.status(200).json({
        message: 'Connexion réussie !',
        username: user.username,
        isPremium: user.isPremium,
        userDailyStats: userDailyStats,
        customization: {
            activeColor: user.activeColor || 'default',
            activeBadge: user.activeBadge || 'none',
            unlockedColors: user.unlockedColors || ['default'],
            unlockedBadges: user.unlockedBadges || ['none']
        }
    });
});

app.post('/premium/toggle', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Nom d'utilisateur manquant" });

    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    const newPremiumStatus = !user.isPremium;

    if (newPremiumStatus) {
        await usersCollection.updateOne(
            { username },
            {
                $set: { isPremium: newPremiumStatus },
                $addToSet: {
                    unlockedColors: { $each: ['premium-gradient', 'supporter-gold'] },
                    unlockedBadges: { $each: ['premium', 'supporter-gold'] }
                }
            }
        );
    } else {
        await usersCollection.updateOne({ username }, { $set: { isPremium: newPremiumStatus } });
    }

    res.status(200).json({ username, isPremium: newPremiumStatus });
});

app.post('/users/statuses', async (req, res) => {
    try {
        const { usernames } = req.body;
        if (!usernames || !Array.isArray(usernames)) { return res.status(400).json({ error: "Un tableau de noms d'utilisateurs est requis." }); }
        
        const users = await usersCollection.find(
            { username: { $in: usernames } },
            { projection: { username: 1, isPremium: 1, activeColor: 1, activeBadge: 1, unlockedColors: 1, unlockedBadges: 1, _id: 0 } }
        ).toArray();

        const statusMap = users.reduce((acc, user) => {
            acc[user.username] = {
                isPremium: user.isPremium,
                activeColor: user.activeColor || 'default',
                activeBadge: user.activeBadge || 'none',
                unlockedColors: user.unlockedColors || ['default'],
                unlockedBadges: user.unlockedBadges || ['none']
            };
            return acc;
        }, {});
        res.status(200).json(statusMap);
    } catch (error) { res.status(500).json({ error: "Erreur lors de la récupération des statuts." }); }
});

app.post('/users/customize', async (req, res) => {
    const { username, newColor, newBadge } = req.body;
    if (!username || !newColor || !newBadge) {
        return res.status(400).json({ error: "Informations de personnalisation manquantes." });
    }

    try {
        const user = await usersCollection.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "Utilisateur non trouvé." });
        }

        const userUnlockedColors = user.unlockedColors || [];
        const userUnlockedBadges = user.unlockedBadges || [];

        const hasColor = userUnlockedColors.includes(newColor);
        const hasBadge = userUnlockedBadges.includes(newBadge);

        if (!hasColor || !hasBadge) {
            return res.status(403).json({ error: "Vous ne possédez pas ces objets de personnalisation." });
        }
        
        if ((newColor.includes('premium') || newColor.includes('supporter-gold') || newBadge.includes('premium') || newBadge.includes('supporter-gold')) && !user.isPremium) {
            return res.status(403).json({ error: "Vous devez être Premium pour utiliser cet objet." });
        }

        await usersCollection.updateOne(
            { username },
            { $set: { activeColor: newColor, activeBadge: newBadge } }
        );

        res.status(200).json({ message: "Profil mis à jour avec succès !" });

    } catch (error) {
        console.error("Erreur dans /users/customize:", error);
        res.status(500).json({ error: "Erreur lors de la mise à jour du profil." });
    }
});


app.post('/create-checkout-session', async (req, res) => {
    const { username, plan } = req.body;
    if (!username || !plan) {
        return res.status(400).json({ error: 'Informations de plan manquantes.' });
    }

    const appUrl = process.env.YOUR_APP_URL || `http://localhost:${port}`;
    let lineItem = {};
    let sessionMode = 'payment';

    try {
        switch (plan) {
            case 'monthly':
                sessionMode = 'subscription';
                lineItem = {
                    price_data: {
                        currency: 'eur',
                        product_data: { name: 'BrawlArena.gg - Premium (Mensuel)' },
                        unit_amount: 200,
                        recurring: { interval: 'month' },
                    },
                    quantity: 1,
                };
                break;
            case 'annual':
                sessionMode = 'subscription';
                lineItem = {
                    price_data: {
                        currency: 'eur',
                        product_data: { name: 'BrawlArena.gg - Premium (Annuel)' },
                        unit_amount: 1500,
                        recurring: { interval: 'year' },
                    },
                    quantity: 1,
                };
                break;
            case 'lifetime':
                sessionMode = 'payment';
                lineItem = {
                    price_data: {
                        currency: 'eur',
                        product_data: { name: 'BrawlArena.gg - Premium (À vie)' },
                        unit_amount: 4000,
                    },
                    quantity: 1,
                };
                break;
            default:
                return res.status(400).json({ error: 'Plan non valide.' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: sessionMode,
            line_items: [lineItem],
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

// --- Administration ---
app.get('/admin/users', isAdmin, async (req, res) => {
    try {
        const users = await usersCollection.find({}, {
            projection: { password: 0 }
        }).toArray();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs." });
    }
});

app.post('/admin/ban', isAdmin, async (req, res) => {
    const { usernameToBan, type, durationInDays } = req.body;
    if (!usernameToBan || !type) {
        return res.status(400).json({ error: 'Informations manquantes.' });
    }

    try {
        let updateData = {};
        if (type === 'permanent') {
            updateData = { $set: { isBannedPermanently: true, banExpiresAt: null } };
        } else if (type === 'temporary' && durationInDays > 0) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + parseInt(durationInDays));
            updateData = { $set: { isBannedPermanently: false, banExpiresAt: expiryDate } };
        } else if (type === 'unban') {
            updateData = { $set: { isBannedPermanently: false, banExpiresAt: null } };
        } else {
            return res.status(400).json({ error: 'Type de bannissement invalide.' });
        }

        const result = await usersCollection.updateOne({ username: usernameToBan }, updateData);
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }
        res.status(200).json({ message: `L'action sur l'utilisateur ${usernameToBan} a été appliquée.` });

    } catch (error) {
        res.status(500).json({ error: "Erreur lors de l'opération de bannissement." });
    }
});

app.post('/admin/user/customizations', isAdmin, async (req, res) => {
    const { username, colors, badges } = req.body;

    if (!username || !Array.isArray(colors) || !Array.isArray(badges)) {
        return res.status(400).json({ error: "Données invalides. 'username', 'colors', et 'badges' sont requis." });
    }

    try {
        const result = await usersCollection.updateOne(
            { username: username },
            { $set: { unlockedColors: colors, unlockedBadges: badges } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé.' });
        }

        res.status(200).json({ message: `Les cosmétiques de ${username} ont été mis à jour.` });
    } catch (error) {
        console.error("Erreur dans /admin/user/customizations:", error);
        res.status(500).json({ error: "Erreur serveur lors de la mise à jour." });
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


// --- Tournois & Équipes ---
// MODIFICATION : Route de création de tournoi mise à jour
app.post('/tournaments', async (req, res) => {
    const { creator, name, description, dateTime, format, maxParticipants, prize } = req.body;
    if (!creator || !name || !dateTime || !format || !maxParticipants) {
        return res.status(400).json({ error: "Informations manquantes pour créer le tournoi." });
    }

    const user = await usersCollection.findOne({ username: creator });
    if (!user) return res.status(404).json({ error: "Utilisateur créateur introuvable." });
    if (!user.isPremium) return res.status(403).json({ error: "Seuls les membres Premium peuvent créer des tournois." });

    const today = new Date().toISOString().split('T')[0];
    const dailyTournaments = user.lastTournamentDate === today ? (user.dailyTournaments || 0) : 0;

    if (dailyTournaments >= 1) {
        return res.status(403).json({ error: "Vous avez déjà créé votre tournoi pour aujourd'hui." });
    }
    
    try {
        const nextId = await getNextSequenceValue('tournamentId');

        const newTournament = {
            _id: nextId, // Utilisation de l'ID numérique
            creator, name, description, dateTime: new Date(dateTime), format, maxParticipants, prize,
            teams: [], status: 'Upcoming', bracket: null, createdAt: new Date()
        };

        await tournamentsCollection.insertOne(newTournament);
        await usersCollection.updateOne(
            { _id: user._id }, // Correction : On utilise directement user._id
            { $set: { lastTournamentDate: today }, $inc: { dailyTournaments: 1 } }
        );

        res.status(201).json({ message: 'Tournoi créé avec succès !', tournament: newTournament });

    } catch(error) {
        console.error("Erreur lors de la création du tournoi :", error);
        res.status(500).json({ error: "Erreur serveur lors de la création du tournoi." });
    }
});

app.get('/tournaments', async (req, res) => {
    try {
        const allTournaments = await tournamentsCollection.aggregate([
            { $sort: { dateTime: 1 } },
            {
                $lookup: {
                    from: 'teams', localField: 'teams', foreignField: '_id', as: 'teamDetails'
                }
            }
        ]).toArray();
        res.status(200).json(allTournaments);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des tournois." });
    }
});

// MODIFICATION : Route de récupération de tournoi mise à jour pour être plus robuste
app.get('/tournaments/:id', async (req, res) => {
    try {
        const idParam = req.params.id;
        let query;

        // On essaie de convertir l'ID en nombre.
        const numericId = parseInt(idParam, 10);

        // Si c'est un nombre valide, on l'utilise pour la recherche.
        // Sinon, on suppose que c'est un ObjectId.
        if (!isNaN(numericId) && String(numericId) === idParam) {
            query = { _id: numericId };
        } else {
            // Pour être sûr que c'est un format ObjectId valide avant de faire la requête
            if (ObjectId.isValid(idParam)) {
                query = { _id: new ObjectId(idParam) };
            } else {
                 return res.status(400).json({ error: 'Format d\'ID de tournoi invalide.' });
            }
        }

        const tournament = await tournamentsCollection.aggregate([
            { $match: query }, // On utilise notre requête dynamique
            {
                $lookup: {
                    from: 'teams', localField: 'teams', foreignField: '_id', as: 'teamDetails'
                }
            }
        ]).toArray();

        if (tournament.length === 0) {
            return res.status(404).json({ error: 'Tournoi non trouvé.' });
        }
        res.status(200).json(tournament[0]);

    } catch (error) {
        console.error("Erreur dans GET /tournaments/:id:", error);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// MODIFICATION : Route de génération de l'arbre mise à jour
app.post('/tournaments/:id/bracket', async (req, res) => {
    try {
        const tournamentId = parseInt(req.params.id, 10);
        if (isNaN(tournamentId)) {
            return res.status(400).json({ error: 'ID de tournoi invalide.' });
        }
        
        const tournament = await tournamentsCollection.findOne({ _id: tournamentId });
        if (!tournament) return res.status(404).json({ error: 'Tournoi non trouvé.' });

        const teams = await teamsCollection.find({ _id: { $in: tournament.teams } }).toArray();
        if (teams.length < 2) return res.status(400).json({ error: 'Pas assez d\'équipes pour commencer.' });

        for (let i = teams.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [teams[i], teams[j]] = [teams[j], teams[i]];
        }

        const bracket = { rounds: [] };
        const round1 = [];
        for (let i = 0; i < teams.length; i += 2) {
            if (teams[i + 1]) {
                round1.push({
                    match: i / 2 + 1,
                    teams: [{ name: teams[i].name, id: teams[i]._id }, { name: teams[i + 1].name, id: teams[i + 1]._id }],
                    winner: null
                });
            } else {
                round1.push({ match: i / 2 + 1, teams: [{ name: teams[i].name, id: teams[i]._id }, { name: "BYE", id: null }], winner: teams[i]._id });
            }
        }
        bracket.rounds.push(round1);

        let numMatchesInNextRound = Math.floor(round1.length / 2);
        while (numMatchesInNextRound >= 1) {
            const nextRound = Array.from({ length: numMatchesInNextRound }, (_, i) => ({
                match: i + 1, teams: [null, null], winner: null
            }));
            bracket.rounds.push(nextRound);
            if (numMatchesInNextRound === 1) break;
            numMatchesInNextRound = Math.floor(numMatchesInNextRound / 2);
        }

        await tournamentsCollection.updateOne({ _id: tournamentId }, { $set: { status: 'Ongoing', bracket: bracket } });
        res.status(200).json({ message: 'Arbre généré avec succès.', bracket });
    } catch (error) {
        console.error("Erreur lors de la génération de l'arbre:", error);
        res.status(500).json({ error: 'Erreur serveur lors de la génération de l\'arbre.' });
    }
});

// MODIFICATION : Route de suppression de tournoi mise à jour
app.delete('/tournaments/:id', async (req, res) => {
    const { requestingUser } = req.query;
    if (!requestingUser || requestingUser.trim().toLowerCase() !== 'brawlarena.gg') {
        return res.status(403).json({ error: 'Accès non autorisé.' });
    }
    
    try {
        const tournamentId = parseInt(req.params.id, 10);
        if (isNaN(tournamentId)) {
            return res.status(400).json({ error: 'ID de tournoi invalide.' });
        }

        const tournament = await tournamentsCollection.findOne({ _id: tournamentId });
        if (!tournament) {
            return res.status(404).json({ error: 'Tournoi non trouvé.' });
        }

        if (tournament.teams && tournament.teams.length > 0) {
            // Les IDs dans tournament.teams sont des ObjectId, donc la requête est correcte
            await teamsCollection.deleteMany({ _id: { $in: tournament.teams } });
        }

        const result = await tournamentsCollection.deleteOne({ _id: tournamentId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Tournoi non trouvé lors de la tentative de suppression.' });
        }

        res.status(200).json({ message: 'Tournoi et toutes les équipes associées supprimés avec succès.' });
    } catch (error) {
        console.error("Erreur dans DELETE /tournaments/:id:", error);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

app.post('/teams', async (req, res) => {
    const { tournamentId, teamName, creator, isPrivate, joinCode } = req.body;
    if (!tournamentId || !teamName || !creator) {
        return res.status(400).json({ error: 'Informations manquantes pour la création de l\'équipe.' });
    }
    if (isPrivate && !joinCode) {
        return res.status(400).json({ error: 'Une équipe privée nécessite un code pour la rejoindre.' });
    }

    try {
        // --- DÉBUT DE LA CORRECTION ---
        let query;
        const numericTournamentId = parseInt(tournamentId, 10);

        // Correction ici : On utilise '==' au lieu de '===' pour comparer un string et un nombre
        if (!isNaN(numericTournamentId) && String(numericTournamentId) == tournamentId) {
            query = { _id: numericTournamentId };
        } else {
            if (ObjectId.isValid(tournamentId)) {
                query = { _id: new ObjectId(tournamentId) };
            } else {
                return res.status(400).json({ error: 'Format d\'ID de tournoi invalide.' });
            }
        }
        
        const tournament = await tournamentsCollection.findOne(query);
        // --- FIN DE LA CORRECTION ---
        // --- FIN DE LA CORRECTION ---

        if (!tournament) return res.status(404).json({ error: 'Tournoi non trouvé.' });
        if (tournament.teams.length >= tournament.maxParticipants) {
             return res.status(403).json({ error: 'Ce tournoi est complet.' });
        }

        const userInAnotherTeam = await teamsCollection.findOne({ tournamentId: tournament._id, members: creator });
        if (userInAnotherTeam) {
            return res.status(409).json({ error: 'Vous êtes déjà dans une équipe pour ce tournoi.' });
        }

        const newTeam = {
            tournamentId: tournament._id, // Utilise l'ID correct trouvé (numérique ou ObjectId)
            name: teamName, creator, members: [creator],
            isPrivate: !!isPrivate, joinCode: (isPrivate) ? joinCode : null
        };

        const result = await teamsCollection.insertOne(newTeam);
        await tournamentsCollection.updateOne({ _id: tournament._id }, { $push: { teams: result.insertedId } });

        res.status(201).json(newTeam);
    } catch (error) {
        console.error("Erreur à la création de l'équipe :", error);
        res.status(500).json({ error: 'Erreur serveur lors de la création de l\'équipe.' });
    }
});

app.post('/teams/:id/join', async (req, res) => {
    const { username, joinCode } = req.body;
    if (!username) return res.status(400).json({ error: 'Nom d\'utilisateur manquant.' });

    try {
        const teamObjectId = new ObjectId(req.params.id); // L'ID d'une équipe reste un ObjectId
        const team = await teamsCollection.findOne({ _id: teamObjectId });

        if (!team) return res.status(404).json({ error: 'Équipe non trouvée.' });
        if (team.members.length >= 3) return res.status(403).json({ error: 'Cette équipe est complète.' });
        if (team.isPrivate && team.joinCode !== joinCode) {
            return res.status(403).json({ error: 'Code pour rejoindre incorrect.' });
        }

        const userInAnotherTeam = await teamsCollection.findOne({ tournamentId: team.tournamentId, members: username });
        if (userInAnotherTeam) {
            return res.status(409).json({ error: 'Vous êtes déjà dans une équipe pour ce tournoi.' });
        }

        await teamsCollection.updateOne({ _id: teamObjectId }, { $push: { members: username } });
        res.status(200).json({ message: 'Équipe rejointe avec succès !' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// =================================================================
//      SERVEUR DE FICHIERS STATIQUES (DOIT ÊTRE APRÈS LES ROUTES API)
// =================================================================
app.use(express.static(__dirname));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});