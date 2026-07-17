# Rapport Maxi couche 176 - Test webhook stock idempotent

Date: 2026-06-12

## Objectif

Prouver localement que le webhook Stripe signe peut traiter une commande dropshipping sans double decrement de stock, meme si Stripe rejoue le meme evenement.

## Changements integres

- `scripts/automation/test_stripe_webhook_stock_idempotence.mjs`
  - Demarre un serveur Next local temporaire avec secrets Stripe factices.
  - Injecte une fixture produit + commande dans `data/quick-products.json` et `data/dropshipping-orders.json`.
  - Genere une signature HMAC compatible Stripe pour un evenement `checkout.session.completed`.
  - Poste deux fois le meme webhook sur `/api/stripe/webhook`.
  - Verifie:
    - premier webhook accepte;
    - stock fixture `7 -> 5`;
    - commande marquee `paid` + `stockDecrementStatus: done`;
    - second webhook accepte;
    - stock toujours `5`, donc idempotence OK.
  - Restaure exactement les fichiers data apres le test.

- `package.json`
  - Ajout de `npm run catalog:test-stripe-webhook-stock-idempotence`.

- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
  - Ajout du test runtime dans les commandes de la branche confiance/checkout.

## Sauvegarde

Sauvegarde avant modification:

`business-maxi-trouvailles/sauvegardes/20260612_couche_176_webhook_idempotence_test/`

La sauvegarde contient aussi `quick-products.json.before-test.bak` et `dropshipping-orders.json.before-test.bak`.

## Validations executees

- `npm run catalog:test-stripe-webhook-stock-idempotence` - OK
  - Premier webhook: `200`
  - Stock apres premier webhook: `5`
  - Second webhook: `200`
  - Stock apres second webhook: `5`
  - Data restauree: OK
- `npm run catalog:audit-stripe-webhook-stock-guards` - OK
- `npm run catalog:audit-checkout-eligibility` - OK
- `npm run catalog:test-checkout-guards` - OK
- `npm run typecheck` - OK
- `npm run lint` - OK
- `npm run build` - OK
- Controle fixture residuelle dans `data/*.json` - OK, aucune fixture restee
- Controle processus serveur temporaire - OK, aucun serveur 3042 restant
- Scan anti-fuite sur script/rapports/doc/package - OK, aucun motif de secret reel detecte

## Incident corrige dans la couche

Premier lancement du test: echec `spawn EINVAL` avant demarrage Next, avec restauration data OK.

Correction appliquee: lancement direct du binaire Next via `node node_modules/next/dist/bin/next dev --webpack`, plus fiable que `npm.cmd` dans ce contexte Windows.

## Limites

- Aucun appel reseau Stripe reel.
- Aucun paiement, aucune commande fournisseur, aucune publication, aucun deploiement.
- Le test couvre le chemin webhook local et l'idempotence stock; il ne remplace pas un test webhook Stripe officiel en mode test avec compte configure par Mouss.
- Les produits publics restent en HOLD tant que les preuves fournisseur/image/stock/delai/droits/validation humaine ne sont pas completes.

## Statut

HOLD securise.

Le chemin paiement/stock a maintenant une preuve runtime locale: replay webhook signe sans double decrement.

## Prochain pas recommande

Ajouter une couche admin "commandes a verifier" qui met en avant les commandes payees avec `stockDecrementStatus: failed` ou `skipped`, pour que Mouss voie immediatement les cas a reprendre avant commande fournisseur.
