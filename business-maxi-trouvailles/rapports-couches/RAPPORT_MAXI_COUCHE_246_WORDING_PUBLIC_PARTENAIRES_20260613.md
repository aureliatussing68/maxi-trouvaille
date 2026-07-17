# Rapport couche 246 - Wording public partenaires

Date locale: 2026-06-13 10:54 Europe/Paris

## Objectif

Nettoyer les pages publiques secondaires avant la demonstration 20h pour eviter le vocabulaire interne ou trop chantier autour de la future marketplace.

## Changements integres localement

- `src/app/vendre/page.tsx`: suppression de l'import `@/lib/marketplace` et remplacement de la page par un discours public "Programme partenaires Maxi Trouvaille".
- `src/app/deposer-annonce/page.tsx`: remplacement du placeholder marketplace par une page "Rejoindre le programme partenaires".
- `src/app/faq/page.tsx`: question publique remplacee par "L'espace partenaires est-il deja ouvert ?" sans mention marketplace.

## Verification anti-fuite

- Scan public hors admin/API: aucune occurrence visible de `AliExpress`, `fournisseur`, `supplier`, `seller`, `marketplace`, `API Mondial`, `sans API`.
- Controle mobile navigateur local 390x844 sur `/vendre`, `/deposer-annonce`, `/faq`: H1 presents, aucun debordement horizontal, aucun terme interdit visible, aucune erreur console.

## Tests

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible, 0 achetable, 91 brouillons bloques
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding
- `npm run catalog:audit-public-visual-ambiguity`: OK
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit attendu achetable

## Garde-fous

Aucun paiement, aucune commande fournisseur, aucun achat, aucun message reel, aucune API payante, aucune publication produit et aucun deploiement production dans cette couche.
