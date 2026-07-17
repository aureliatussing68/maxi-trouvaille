# Rapport couche 145 - Verrou public readiness dropshipping

Date: 2026-06-11
Statut: HOLD public maintenu

## Objectif

Fermer le risque principal signale par Mouss: une fiche dropshipping ne doit jamais redevenir visible ou achetable si l'image exacte, le fournisseur, le SKU, le prix fournisseur, la marge, le stock, le delai, les droits image ou la validation humaine ne sont pas prouves.

## Modifications integrees

- `src/lib/catalog.ts`: ajout du verrou `getDropshippingPublicBlockers` et `isDropshippingProductReadyForPublic`.
- `src/lib/catalog.ts`: `isPublicProduct` et `isProductPurchasable` refusent maintenant toute fiche dropshipping sans readiness complete, meme si son statut est publie par erreur.
- `scripts/automation/audit_public_dropshipping_surface.mjs`: l'audit public controle le meme verrou que le catalogue, detecte les fiches publiees mais incompletes et verifie la presence du gate cote code.
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`: consigne locale mise a jour pour garder ce verrou actif a chaque couche.

## Produits

- Produit ajoute: 0.
- Produit publie: 0.
- Produit rendu achetable: 0.
- Les 37 fiches partenaires restent bloquees en HOLD tant que les preuves exactes ne sont pas completes.
- Les 57 fiches issues de l'ajout rapide restent en brouillon.

## Preuves et controles

- `npm run catalog:audit-public-dropshipping-surface`: OK.
  - visibleDropshippingCount: 0
  - purchasableDropshippingCount: 0
  - failureCount: 0
  - warningCount: 0
  - draftBlockedCount: 37
  - publishedReadinessFailureCount: 0
- `npm run catalog:audit-quick-product-hold`: OK.
  - totalQuickProducts: 57
  - draftCount: 57
  - publishedCount: 0
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- `npm run catalog:daily-execution-board`: OK, tableau du jour regenere en lecture seule.
- Browser local `http://127.0.0.1:3064`: OK sur `/boutique` et `/produits-partenaires`, mobile 390px et desktop 1440px.
  - HTTP 200.
  - 0 lien produit public.
  - 0 carte produit publique.
  - 0 erreur console.
  - 0 debordement horizontal.

## Limites

- Ce verrou ne valide pas encore les photos; il empeche seulement la vente publique tant que les preuves ne sont pas completes.
- La prochaine couche rentable reste l'atelier visuels exacts: deposer les premiers WebP P0, completer les preuves fournisseur, puis recontroler fiche par fiche avant tout GO humain.

## Sauvegardes

- Avant couche: `backups/couche-145-public-readiness-gate-pre-20260611-183123`.
- Apres couche: `backups/couche-145-public-readiness-gate-final-20260611-184100`.

## Prochaine action recommandee

Remplir `/admin/visuels-exacts` avec les images exactes P0 et les champs fournisseur/prix/stock/delai/droits image, puis debloquer seulement les fiches qui passent le verrou readiness sans aucun blocker.
