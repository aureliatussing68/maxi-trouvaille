# Rapport Maxi couche 365 - Accueil support mobile

Date: 2026-06-18 21:13 Europe/Paris

## Objectif
Renforcer l'accueil public mobile avec le support complet Maxi Trouvaille, sans modifier le catalogue ni rendre une fiche achetable.

## Integrations
- Ajout du bloc `CustomerSupportQuickLinks` sur `/`.
- Ajout de l'audit `scripts/automation/audit_partner_home_surface.mjs`.
- Ajout du script `catalog:audit-partner-home-surface`.
- Sauvegarde avant modification: `business-maxi-trouvailles/backups/couche-365-accueil-support-mobile-20260618`.

## Validations
- `npx eslint src/app/page.tsx`
- `node --check scripts/automation/audit_partner_home_surface.mjs`
- `npm run catalog:audit-partner-home-surface`
- Audits publics partenaires, categories, boutique, routes, mobile, catalogue public, panier protege, SEO et artefacts generes.
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Verification mobile
Route testee en 390 x 844:
- `/`

Resultat:
- Bloc support visible sur l'accueil.
- 6 liens support presents: suivi, paiement, livraison, retours, FAQ, contact.
- Liens globaux presents vers boutique, produits partenaires, suivi, paiement et contact.
- Navigation mobile visible vers boutique, partenaires, nouveautes, promotions et suivi.
- Aucun debordement horizontal.
- Aucune erreur console locale.
- Aucun terme sensible visible cote client.

## Garde-fous
- Aucune commande, aucun paiement reel, aucune publication.
- Aucune connexion compte, aucun message reel, aucune API payante.
- Aucune fiche produit rendue achetable.
- Les produits sans preuves completes restent verrouilles.
