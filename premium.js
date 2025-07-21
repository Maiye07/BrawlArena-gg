document.addEventListener('DOMContentLoaded', () => {
    // Vérifie si un utilisateur est connecté, sinon le renvoie à l'accueil
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    const API_URL = 'https://brawlarena-gg.onrender.com';
    const confirmButton = document.getElementById('confirm-purchase-button');

    confirmButton.addEventListener('click', async () => {
        try {
            // Désactive le bouton pour éviter les double-clics
            confirmButton.disabled = true;
            confirmButton.textContent = 'Préparation...';

            const response = await fetch(`${API_URL}/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loggedInUsername })
            });

            if (!response.ok) {
                throw new Error("Impossible de préparer le paiement.");
            }

            const session = await response.json();
            // Redirige l'utilisateur vers la page de paiement Stripe
            window.location.href = session.url;

        } catch (error) {
            alert(error.message);
            // Réactive le bouton en cas d'erreur
            confirmButton.disabled = false;
            confirmButton.textContent = 'Procéder au paiement';
        }
    });
});