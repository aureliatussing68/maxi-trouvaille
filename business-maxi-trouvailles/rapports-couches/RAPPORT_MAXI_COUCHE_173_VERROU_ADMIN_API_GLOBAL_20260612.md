# Rapport Maxi Couche 173 - Verrou admin API global

Date: 2026-06-12

## Objectif

Uniformiser la protection de toutes les routes `/api/admin/*` pour eviter toute lecture, mutation catalogue, mutation commande, moderation avis ou consommation OpenAI depuis la surface publique.

## Fichiers touches

- `src/lib/admin-api.ts`
- `src/app/api/admin/dropshipping/import/route.ts`
- `src/app/api/admin/dropshipping/orders/route.ts`
- `src/app/api/admin/dropshipping/orders/[orderId]/route.ts`
- `src/app/api/admin/dropshipping/sync/route.ts`
- `src/app/api/admin/products/route.ts`
- `src/app/api/admin/products/decrement/route.ts`
- `src/app/api/admin/products/photo-analysis/route.ts`
- `src/app/api/admin/products/[slug]/route.ts`
- `src/app/api/admin/products/[slug]/image/route.ts`
- `src/app/api/admin/reviews/[reviewId]/route.ts`
- `scripts/automation/audit_admin_api_guards.mjs`
- `package.json`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`

Sauvegarde: `backups/couche-173-audit-admin-api-guards-20260612-035109`

## Changements

- Ajout du helper `adminApiUnavailable()` qui masque les routes admin en `404`.
- Toutes les routes `src/app/api/admin/**/route.ts` utilisent maintenant `isAdminModeEnabled()` puis `adminApiUnavailable()` avant leur travail sensible.
- Ajout de `npm run catalog:audit-admin-api-guards`.
- L'audit controle les 10 routes admin et 14 methodes HTTP, avec verification du garde avant lecture de payload, appel OpenAI, lecture/ecriture catalogue, mutation commande ou avis.

## Produits

- Produits ajoutes: 0
- Produits publies: 0
- Commandes fournisseur: 0
- Mutations catalogue: aucune volontaire hors code

## Preuves

- `catalog:audit-admin-api-guards`: OK, 10 routes, 14 methodes, 0 echec.
- Test public local `ADMIN_MODE=false` sur `http://localhost:3028`:
  - `GET /api/admin/products` -> 404
  - `GET /api/admin/dropshipping/orders` -> 404
  - `GET /api/admin/dropshipping/sync` -> 404
  - `POST /api/admin/dropshipping/import` -> 404
  - `PATCH /api/admin/dropshipping/orders/test-order` -> 404
  - `PATCH /api/admin/reviews/test-review` -> 404
  - `POST /api/admin/products/photo-analysis` -> 404
- Toutes les reponses testees: `{"error":"Admin indisponible."}`.

## Tests executes

- `npm run catalog:audit-admin-api-guards` - OK
- `npm run catalog:audit-checkout-eligibility` - OK
- `npm run typecheck` - OK
- `npm run lint` - OK
- `npm run build` - OK
- `npm run catalog:audit-public-dropshipping-surface` - OK, 0 failure, 2 warnings existants
- `git diff --check` - OK
- Scan anti-fuite - OK: seulement noms de variables OpenAI, mots `token/secret` dans consignes/audit, aucune valeur sensible

## Statut

GO local pour le verrou admin API global.

Prochain pas recommande: ajouter un audit complementaire des pages `/admin/*` pour confirmer qu'elles n'affichent pas de tableaux internes quand `ADMIN_MODE` est absent, puis preparer un vrai schema webhook Stripe signe pour stock/commande.
