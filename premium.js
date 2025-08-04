document.addEventListener('DOMContentLoaded', () => {
    // Vérifie si un utilisateur est connecté, sinon le renvoie à l'accueil
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) {
        window.location.href = 'index.html';
        return;
    }

    const API_URL = 'https://brawlarena-gg.onrender.com';
    const planButtons = document.querySelectorAll('.select-plan-button');

    planButtons.forEach(clickedButton => {
        // On garde en mémoire le texte original de chaque bouton
        const originalButtonText = clickedButton.textContent;

        clickedButton.addEventListener('click', async () => {
            const plan = clickedButton.dataset.plan;

            try {
                // 1. Désactive TOUS les boutons pour éviter les clics multiples
                planButtons.forEach(btn => btn.disabled = true);
                
                // 2. Change le texte UNIQUEMENT du bouton cliqué
                clickedButton.textContent = 'Préparation...';

                const response = await fetch(`${API_URL}/create-checkout-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUsername, plan: plan })
                });

                // 3. Gestion d'erreur améliorée
                if (!response.ok) {
                    let errorMessage = "Impossible de préparer le paiement.";
                    // On essaie de lire l'erreur au format JSON
                    try {
                        const errorData = await response.json();
                        if (errorData && errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        // Si ce n'est pas du JSON, on affiche une erreur générique
                        errorMessage = `Une erreur serveur est survenue (Code: ${response.status})`;
                    }
                    throw new Error(errorMessage);
                }

                const session = await response.json();
                // Redirige l'utilisateur vers la page de paiement Stripe
                window.location.href = session.url;

            } catch (error) {
                alert(error.message);
                
                // 4. Réactivation propre des boutons en cas d'erreur
                planButtons.forEach(btn => {
                    btn.disabled = false;
                });
                
                // On restaure le texte original du bouton qui avait été cliqué
                clickedButton.textContent = originalButtonText;
            }
        });
    });
});