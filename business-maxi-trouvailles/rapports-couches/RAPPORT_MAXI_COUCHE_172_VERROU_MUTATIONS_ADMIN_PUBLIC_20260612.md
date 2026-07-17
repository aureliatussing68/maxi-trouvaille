# Rapport Maxi Couche 172 - Verrou mutations admin publiques

Date: 2026-06-12

## Objectif

Fermer deux surfaces publiques dangereuses apres le verrou panier: consommation OpenAI possible via analyse photo admin et mutation de stock possible via decrement stock appele depuis le navigateur.

## Fichiers touches

- `src/app/api/admin/products/photo-analysis/route.ts`
- `src/app/api/admin/products/decrement/route.ts`
- `src/components/OrderSuccess.tsx`
- `scripts/automation/audit_checkout_eligibility.mjs`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`

Sauvegarde: `backups/couche-172-verrou-admin-mutations-20260612-034519`

## Changements

- `POST /api/admin/products/photo-analysis` refuse hors `ADMIN_MODE=true` avant lecture du formulaire et avant tout appel OpenAI.
- `POST /api/admin/products/decrement` refuse hors `ADMIN_MODE=true` avant lecture payload et avant mutation de stock.
- La page `paiement/succes` ne fait plus de fetch client vers `/api/admin/products/decrement`.
- Le panier est toujours vide cote client apres succes paiement via `clearCart()`.
- `catalog:audit-checkout-eligibility` verifie maintenant:
  - aucun appel client de decrement stock admin depuis `OrderSuccess`;
  - guard admin sur `photo-analysis`;
  - guard admin sur `decrement`;
  - garde-fous couche 171 conserves.

## Produits

- Produits ajoutes: 0
- Produits publies: 0
- Stock modifie: non
- Catalogue: aucun changement volontaire

## Preuves et limites

- Test public local sur `http://localhost:3027` avec `ADMIN_MODE=false`.
- `POST /api/admin/products/decrement`: `404`, body `{"error":"Admin indisponible."}`.
- `POST /api/admin/products/photo-analysis`: `404`, body `{"error":"Admin indisponible."}`.
- Hash `data/quick-products.json` inchange avant/apres test decrement, test photo-analysis et navigation page succes.
- Page mobile `/paiement/succes?session_id=cs_test_fake`: aucune requete `/api/admin/products/decrement`, panier local purge en `[]`.
- Capture: `business-maxi-trouvailles/captures/couche-172/paiement-succes-mobile-no-admin-decrement.png`
- Limite: le decrement stock devra etre rebranche plus tard cote serveur/webhook Stripe confirme, jamais depuis le navigateur.

## Tests executes

- `npm run typecheck` - OK
- `npm run lint` - OK
- `npm run catalog:audit-checkout-eligibility` - OK, nouveaux guards a `true`
- `npm run catalog:test-checkout-guards` - OK, 11/11 cas
- `npm run catalog:audit-public-dropshipping-surface` - OK, 0 failure, 2 warnings existants
- `npm run build` - OK
- Playwright mobile succes paiement + POST endpoints admin publics - OK
- `git diff --check` - OK
- Scan anti-fuite - OK: seulement noms de variables OpenAI attendus, chemin `purchase-token` et consignes anti-secret, aucune valeur sensible

## Statut

GO local pour le verrou mutations admin publiques.

Prochain pas recommande: ajouter un traitement stock/commande cote webhook Stripe signe, lie aux drafts dropshipping, avec idempotence par `session.id` avant d'activer des produits vendables.
