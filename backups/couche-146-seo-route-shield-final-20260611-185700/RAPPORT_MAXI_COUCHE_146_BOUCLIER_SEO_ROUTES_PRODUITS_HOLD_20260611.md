# Rapport couche 146 - Bouclier SEO et routes produits HOLD

Date: 2026-06-11
Statut: HOLD public maintenu

## Objectif

Eviter qu'une ancienne URL produit, un resultat Google ou un acces direct mobile affiche encore une fiche avec mauvaise image. Le bouclier SEO doit utiliser exactement le meme niveau d'exigence que le catalogue public dropshipping.

## Modifications integrees

- `scripts/automation/audit_seo_hold_visibility.mjs`: l'audit SEO applique maintenant le verrou readiness dropshipping complet avant de compter un produit comme indexable.
- `scripts/automation/audit_seo_hold_visibility.mjs`: ajout du controle du lookup public par slug, qui doit toujours repasser par `isPublicProduct`.
- `scripts/automation/audit_seo_hold_visibility.mjs`: ajout du compteur `routeShieldedProductCount` pour les slugs publies mais blindes hors route publique.
- `scripts/automation/audit_seo_hold_visibility.mjs`: export CSV enrichi avec `routeShielded` et les blockers readiness.
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`: consigne de chantier mise a jour pour garder ce bouclier actif.

## Produits

- Produit ajoute: 0.
- Produit publie: 0.
- Produit rendu achetable: 0.
- Produits indexables attendus: 0.
- Produits non publics/HOLD: 67.
- Slugs publies mais blindes hors route produit publique: 4.

## Preuves et controles

- `npm run catalog:audit-seo-hold-visibility`: OK.
  - publicProductCount: 0
  - nonPublicProductCount: 67
  - routeShieldedProductCount: 4
  - readinessBlockedProductCount: 0
  - failureCount: 0
- `npm run catalog:audit-public-dropshipping-surface`: OK.
  - visibleDropshippingCount: 0
  - purchasableDropshippingCount: 0
  - failureCount: 0
  - draftBlockedCount: 37
  - publishedReadinessFailureCount: 0
- `npm run catalog:daily-execution-board`: OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Browser local `http://127.0.0.1:3065`: OK.
  - `/produit/palette-mystere-destockage`: 404, 0 image, 0 achat.
  - `/produit/colis-surprise-10-kg`: 404, 0 image, 0 achat.
  - `/produit/colis-mystere-premium`: 404, 0 image, 0 achat.
  - `/produit/lot-special-marche`: 404, 0 image, 0 achat.
  - `/sitemap.xml`: 200, 0 URL produit.

## Sauvegardes

- Avant couche: `backups/couche-146-seo-route-shield-pre-20260611-184900`.
- Apres couche: `backups/couche-146-seo-route-shield-final-20260611-185700`.

## Prochaine action recommandee

Attaquer le lot P0 images exactes dans `/admin/visuels-exacts`, puis relancer `catalog:audit-sprint-image-local-files`, `catalog:audit-sprint-image-human-review`, `catalog:audit-seo-hold-visibility` et `catalog:audit-public-dropshipping-surface` avant tout passage en revue humaine.
