# Rapport Maxi Couche 372 - Offline demo mobile

Date locale: 2026-06-19 03:59 Europe/Paris

## Objectif

Rendre la page hors ligne plus presentable sur telephone pendant une demonstration, avec un chemin clair vers les pages utiles, sans rendre achetable une fiche douteuse et sans action sensible.

## Integrations

- `src/app/offline/page.tsx`
  - Ajout d'un bloc `Chemin demo mobile` en 3 etapes: accueil, produits partenaires, service client.
  - Liens de secours limites aux pages publiques utiles.
  - Message de securite conserve: rien n'est envoye hors ligne, les actions sensibles attendent la reconnexion.
- `scripts/automation/audit_offline_demo_surface.mjs`
  - Nouvel audit lecture seule pour la page offline et le service worker.
  - Controle `noindex/nofollow`, signaux demo, fallback `/offline`, absence de raccourcis admin/API/panier/paiement.
  - Controle anti-fuite AliExpress, Temu, fournisseur, supplier, dropshipping, HOLD, Stripe.
- `package.json`
  - Ajout du script `catalog:audit-offline-demo-surface`.

## Audits et validations

- `node --check scripts/automation/audit_offline_demo_surface.mjs` OK.
- `npm run catalog:audit-offline-demo-surface` OK, 8 liens offline detectes, 0 alerte.
- `npx eslint src/app/offline/page.tsx` OK.
- `npm run catalog:audit-rescue-support-surface` OK, 0 alerte.
- `npm run catalog:audit-public-demo-copy` OK, 57 fichiers publics surveilles, 0 alerte.
- `npm run catalog:audit-public-catalog-source-guards` OK, 0 fuite.
- `npm run catalog:audit-mobile-demo-nav` OK, 5 liens requis, 0 alerte.
- `npm run catalog:audit-transactional-noindex-surface` OK, 10 routes surveillees, 0 alerte.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK, 49 pages generees.
- Verification `.next/server/app/offline.html` et `.next/server/app/offline.rsc` OK: chemin demo visible et meta robots `noindex, nofollow`.

## Garde-fous

- Aucun paiement.
- Aucune commande partenaire.
- Aucun achat reel.
- Aucune connexion compte.
- Aucune publication production ou deploiement.
- Aucun message reel.
- Aucune API payante.
- Aucune video pub.
- Aucun produit HOLD rendu public.
- Aucun fournisseur, AliExpress, Temu ou supplier expose cote client.
