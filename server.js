require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware pour lire le JSON envoyé par ton site HTML
app.use(express.json());
app.use(express.static('.'));

// ⚠️ CATALOGUE OFFICIEL CÔTÉ SERVEUR
const PRODUCTS = {
  'mastodonte': { name: "T-shirt Le Mastodonte", priceId: 'price_1UWCOKAZtt33WjfOf63xUrR8' },
  'souverain-des-enfers': { name: "T-shirt Souverain des Enfers", priceId: 'price_1UWCQVAZtt33WjfOfhyXGLja' },
  'ange-de-la-mort': { name: "T-shirt L'Ange de la Mort", priceId: 'price_1UWCRpAZtt33WjfOXWhImNjb' },
  'cyborg': { name: "T-shirt Cyborg", priceId: 'price_1UWCT4AZtt33WjfOB5RD96YC' }
};

const SIZES = ['S', 'M', 'L', 'XL'];
const MAX_QTY = 10;

// Route de paiement sécurisée
app.post('/api/checkout', async (req, res) => {
  try {
    const { items } = req.body;

    // 1. Validation stricte du panier
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Le panier est vide." });
    }

    // 2. Préparation des articles pour Stripe
    const line_items = items.map(item => {
      const product = PRODUCTS[item.id];
      if (!product) {
        throw new Error(`Produit introuvable : ${item.id}`);
      }

      if (item.size && !SIZES.includes(item.size)) {
        throw new Error(`Taille invalide : ${item.size}`);
      }

     const qty = Number(item.quantity || item.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        throw new Error(`Quantité invalide pour ${product.name}`);
      }

      return {
        price: product.priceId,
        quantity: qty
      };
    });

    // 3. Création de la session de paiement Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: 'https://cyberwear.onrender.com/success.html',
      cancel_url: 'https://cyberwear.onrender.com/cancel.html',
    });

    res.json({ id: session.id, url: session.url });

  } catch (err) {
    console.error("Erreur Checkout:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// Lancement du serveur sur le port configuré ou 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur e-commerce prêt sur http://localhost:${PORT}`);
});