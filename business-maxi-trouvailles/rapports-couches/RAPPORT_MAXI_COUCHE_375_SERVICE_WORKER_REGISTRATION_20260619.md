# Rapport Maxi couche 375 - Service worker registration mobile

Date locale: 2026-06-19 04:20 Europe/Paris

## Objectif

Renforcer la fiabilite PWA/mobile de Maxi Trouvaille sans toucher aux produits, aux paiements, aux commandes, aux messages, aux comptes ou au deploiement.

## Integration locale

- `src/components/ServiceWorkerRegister.tsx`
  - Ajout des constantes `serviceWorkerUrl` et `serviceWorkerScope` pour garder l'enregistrement explicite sur `/sw.js` et le scope `/`.
  - Ajout du support local IPv6 `::1`.
  - Ajout d'un garde `cancelled` pour eviter une suite d'effet apres demontage.
  - Ajout d'un `registration.update()` silencieux pour recuperer une version precache plus recente sans bloquer la visite.
  - Remplacement du commentaire lie a l'achat par une phrase neutre: la PWA ne doit jamais bloquer la visite.

- `scripts/automation/audit_offline_demo_surface.mjs`
  - Audit etendu a l'enregistrement PWA client.
  - Controle du Client Component, du support navigateur, du contexte securise/local, du scope public, de l'update silencieux et du montage dans `src/app/layout.tsx`.
  - Garde anti signaux sensibles cote client: pas de fournisseur, supplier, Temu, AliExpress, fetch, stockage local ou message interactif.

## Validations

- `node --check scripts/automation/audit_offline_demo_surface.mjs` OK.
- `npm run catalog:audit-offline-demo-surface` OK: 11 signaux PWA, 0 alerte.
- `npm run catalog:audit-mobile-demo-nav` OK: 5 liens mobile, 6 routes demo SW, 0 alerte.
- `npm run catalog:audit-mobile-manifest` OK: 5 raccourcis, 0 alerte.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-seo-hold-visibility` OK: 121 produits non publics/HOLD, 0 produit public.
- `npm run catalog:audit-partner-checkout-surface` OK.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK.
- `git diff --check -- src\components\ServiceWorkerRegister.tsx scripts\automation\audit_offline_demo_surface.mjs` OK, avec avertissement Git attendu de fin de ligne sur Windows.

## Garde-fous

- Aucune commande fournisseur.
- Aucun paiement, achat reel ou connexion compte.
- Aucun message reel.
- Aucun deploiement ou publication production.
- Aucune API payante.
- Aucun contenu AliExpress, Temu, fournisseur ou supplier expose cote client.
- Aucun produit rendu achetable ou public.

## Prochaine couche conseillee

Continuer cote surface mobile visible: verifier le parcours public accueil -> boutique -> produits partenaires -> panier garde -> paiement garde -> suivi colis, puis renforcer l'audit navigateur sans lancer de publication.
