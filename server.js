require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware pour lire le JSON envoyé par ton site HTML
app.use(express.json());
app.use(express.static('.'));

// ⚠️ CATALOGUE OFFICIEL CÔTÉ SERVEUR (les prix ne peuvent pas être modifiés par le client)
const PRODUCTS = {
  1: { name: "Hoodie Stealth Oversized", priceCents: 7500 },
  2: { name: "T-Shirt Minimal Cyber", priceCents: 4000 },
  3: { name: "Veste M65 Techwear", priceCents: 12000 },
  4: { name: "Hoodie Heavyweight Black", priceCents: 8000 },
  5: { name: "T-Shirt Graphic Acid Wash", priceCents: 4500 },
};

const SIZES = ['S', 'M', 'L', 'XL'];
const MAX_QTY = 10;

// Route de paiement sécurisée
app.post('/api/checkout', async (req, res) => {
  try {
    const { items } = req.body;

    // 1. Validation stricte des données reçues du panier
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Le panier est vide." });
    }

    const line_items = items.map(item => {
      const product = PRODUCTS[item.id];
      
      // Sécurité : Vérifie si le produit existe
      if (!product) {
        throw new Error(`Produit inconnu (ID: ${item.id})`);
      }
      
      // Sécurité : Vérifie si la taille est valide
      if (!SIZES.includes(item.size)) {
        throw new Error(`Taille invalide : ${item.size}`);
      }

      // Sécurité : Vérifie la quantité (entre 1 et 10)
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        throw new Error(`Quantité invalide pour ${product.name}`);
      }

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${product.name} [Taille : ${item.size}]`,
          },
          unit_amount: product.priceCents, // Le prix vient d'ici, impossible à pirater
        },
        quantity: qty,
      };
    });

    // 2. Création de la session de paiement Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `http://localhost:3000/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3000/`,
    });

    // 3. Renvoie l'URL sécurisée de Stripe au site web
    res.json({ url: session.url });

  } catch (err) {
    console.error("Erreur Checkout:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// Lancement du serveur sur le port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur e-commerce prêt sur http://localhost:${PORT}`);
});