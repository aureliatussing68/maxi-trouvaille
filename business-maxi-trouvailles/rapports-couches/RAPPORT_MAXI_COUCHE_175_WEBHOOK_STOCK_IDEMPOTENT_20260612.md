# Rapport Maxi couche 175 - Webhook Stripe stock idempotent

Date: 2026-06-12

## Objectif

Fermer le trou fonctionnel laisse par le retrait du decrement stock cote client: la page succes paiement ne doit jamais toucher au stock, et le stock dropshipping local doit etre ajuste uniquement par le webhook Stripe signe, une seule fois par session.

## Changements integres

- `src/lib/dropshipping-shared.ts`
  - Ajout du statut `DropshippingOrderStockDecrementStatus`: `pending-payment`, `done`, `skipped`, `failed`.
  - Ajout des champs de trace commande: `stockDecrementStatus`, `stockDecrementedAt`, `stockDecrementSource`, `stockDecrementLineCount`, `stockDecrementError`.

- `src/lib/dropshipping-server.ts`
  - Les drafts dropshipping crees avant paiement demarrent en `stockDecrementStatus: "pending-payment"`.
  - `markDropshippingOrderPaid()` marque la commande payee puis decompte les lignes via `decrementQuickProductStock()` uniquement si le stock n'a pas deja ete traite.
  - Garde idempotente: si `stockDecrementedAt`, `done` ou `skipped` existe, un webhook repete ne redecremente pas le stock.
  - Anciennes commandes deja payees sans trace stock: passage en `skipped` avec note de recontrole manuel, pour eviter un double decrement retroactif.
  - En cas d'echec du decrement local: statut `failed`, note interne, erreur serveur relancable par Stripe.

- `src/app/api/stripe/webhook/route.ts`
  - Le webhook continue d'exiger `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, la signature `stripe-signature` et `stripe.webhooks.constructEvent()`.
  - Le traitement `checkout.session.completed` appelle le chemin serveur et renvoie `500` si le stock local echoue, afin de permettre une reprise.

- `src/components/DropshippingAdminPanel.tsx`
  - Badge admin commande: `En attente paiement`, `Stock ajuste`, `Stock a verifier`, `Stock ignore`.
  - Affichage de la date `Stock webhook` quand le decrement est trace.

- `scripts/automation/audit_stripe_webhook_stock_guards.mjs`
  - Nouvel audit lecture seule: signature Stripe, body brut, traitement checkout completed, session dropshipping, helper serveur, idempotence avant decrement, skip legacy, echec retryable, aucune route admin appelee par la page succes.

- `package.json`
  - Ajout de `npm run catalog:audit-stripe-webhook-stock-guards`.

- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
  - Ajout du nouvel audit dans les commandes de la branche confiance/checkout.

## Sauvegarde

Sauvegarde avant modification:

`business-maxi-trouvailles/sauvegardes/20260612_couche_175_webhook_stock_idempotent/`

## Validations executees

- `npm run catalog:audit-stripe-webhook-stock-guards` - OK
- `npm run catalog:audit-checkout-eligibility` - OK
- `npm run catalog:test-checkout-guards` - OK
- `npm run catalog:audit-admin-api-guards` - OK
- `npm run catalog:audit-admin-page-guards` - OK
- `npm run catalog:audit-public-dropshipping-surface` - OK, 0 produit dropshipping achetable sans preuves completes
- `npm run typecheck` - OK
- `npm run lint` - OK
- `npm run build` - OK
- Serveur local temporaire `127.0.0.1:3031`:
  - `POST /api/stripe/webhook` sans config/signature: `400`, traitement refuse
  - `GET /paiement/succes?session_id=cs_test_preview`: `200`
  - `GET /admin/dropshipping`: `200`
  - Serveur stoppe apres verification

## Limites

- Aucun appel Stripe reel effectue, aucun webhook signe rejoue, aucun paiement cree.
- Aucun achat fournisseur, aucune commande fournisseur, aucune publication et aucun deploiement.
- Le navigateur integre n'a pas pu etre utilise: Chrome manque dans le profil Playwright local. Fallback fait par build + requetes HTTP locales.
- Les produits restent en HOLD: l'audit public confirme qu'aucun produit dropshipping n'est achetable tant que les preuves image/fournisseur/prix/stock/delai/droits/Mouss ne sont pas completes.

## Statut

HOLD securise.

Le chemin paiement/stock est mieux prepare pour production controlee, mais la vente reste bloquee tant que les preuves catalogue ne sont pas remplies et validees humainement.

## Prochain pas recommande

Ajouter une couche de simulation locale du webhook avec payload Stripe signe factice en environnement test local, sans compte externe ni paiement reel, pour prouver l'idempotence sur un fichier de commande temporaire avant toute ouverture de paiement.
