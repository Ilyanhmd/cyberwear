const express = require('express');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 1. ROUTE WEBHOOK STRIPE (Doit être placée AVANT express.json())
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Erreur de signature Webhook : ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(`Paiement réussi pour la session : ${session.id}`);

        try {
            const printifyResponse = await fetch(`https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/orders.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    external_id: session.id,
                    line_items: [], // À adapter si tu récupères les variantes précises de Printify
                    address_to: {
                        first_name: session.customer_details?.name || 'Client',
                        last_name: 'CYBERWEAR',
                        email: session.customer_details?.email,
                        phone: session.customer_details?.phone || '0600000000',
                        country: session.shipping_details?.address?.country || 'FR',
                        region: session.shipping_details?.address?.state || '',
                        address1: session.shipping_details?.address?.line1 || 'Adresse non renseignée',
                        city: session.shipping_details?.address?.city || 'Paris',
                        zip: session.shipping_details?.address?.postal_code || '75001'
                    }
                })
            });

            if (!printifyResponse.ok) {
                throw new Error(`Erreur Printify HTTP ${printifyResponse.status}`);
            }

            const printifyData = await printifyResponse.json();
            console.log(`Commande transmise à Printify avec succès ! ID: ${printifyData.id}`);
        } catch (printifyErr) {
            console.error('Erreur lors de la transmission à Printify :', printifyErr);
        }
    }

    res.json({ received: true });
});

// Middleware standard pour lire le JSON
app.use(express.json());
app.use(express.static(__dirname)); // Si tes fichiers sont à la racine, tu peux adapter si besoin

// Définition de tes t-shirts et de leurs priceId Stripe
const PRODUCTS = {
    'mastodonte': { name: "T-shirt Le Mastodonte", priceId: 'price_1UWCOKAZtt33WjfOf63xUrR8' },
    'souverain-des-enfers': { name: "T-shirt Souverain des Enfers", priceId: '' }, // Remets ton priceId ici
    'ange-de-la-mort': { name: "T-shirt L'Ange de la Mort", priceId: '' },       // Remets ton priceId ici
    'cyborg': { name: "T-shirt Cyborg", priceId: '' }                            // Remets ton priceId ici
};

const SIZES = ['S', 'M', 'L', 'XL'];
const MAX_QTY = 10;

// 2. ROUTE DE PAIEMENT SÉCURISÉ
app.post('/api/checkout', async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Le panier est vide." });
        }

        const line_items = items.map(item => {
            const product = PRODUCTS[item.id];
            if (!product) {
                throw new Error(`Produit introuvable : ${item.id}`);
            }

            if (item.size && !SIZES.includes(item.size)) {
                throw new Error(`Taille invalide : ${item.size}`);
            }

            // Gère à la fois 'quantity' et 'qty' pour éviter tout blocage
            const qty = Number(item.quantity || item.qty);
            if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
                throw new Error(`Quantité invalide pour ${product.name}`);
            }

            return {
                price: product.priceId,
                quantity: qty,
            };
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: line_items,
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success.html`,
            cancel_url: `${req.protocol}://${req.get('host')}/`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Erreur Checkout:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// Lancement du serveur
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serveur e-commerce prêt sur http://localhost:${PORT}`);
});