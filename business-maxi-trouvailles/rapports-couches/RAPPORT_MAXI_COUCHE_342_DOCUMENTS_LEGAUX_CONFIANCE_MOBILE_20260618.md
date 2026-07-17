# Rapport Maxi couche 342 - Documents legaux et confiance mobile

Date: 2026-06-18

## Objectif

Renforcer les pages legales publiques pour qu'elles soient coherentes avec la boutique dropshipping Maxi Trouvaille, lisibles sur mobile et alignees avec les garde-fous: paiement Maxi Trouvaille, suivi colis, service client, partenaires logistiques et aucun produit douteux rendu achetable.

## Sauvegarde

Sauvegarde creee avant modification dans:

`business-maxi-trouvailles/backups/couche-342-documents-legaux-confiance-mobile-20260618/`

Fichiers sauvegardes:

- `conditions-generales-vente-page.tsx.bak`
- `mentions-legales-page.tsx.bak`
- `politique-confidentialite-page.tsx.bak`
- `LegalDocument.tsx.bak`
- `legal.ts.bak`

## Integration

- Ajout de `src/components/LegalTrustPanel.tsx` pour afficher un cadre client legal/confiance avec paiement Maxi Trouvaille, suivi colis, retours encadres et liens utiles.
- `src/components/LegalDocument.tsx` accepte maintenant `className` et laisse les pages composer leur mise en page mobile.
- `src/app/conditions-generales-vente/page.tsx`, `src/app/mentions-legales/page.tsx` et `src/app/politique-confidentialite/page.tsx` affichent maintenant le panneau de controle service, le cadre client et le document legal.
- `src/lib/legal.ts` met a jour les dates au 18 juin 2026 et clarifie les points dropshipping utiles: produit partenaire achetable seulement apres controle suffisant, livraison/suivi colis et partage limite aux donnees utiles.

## Produits et HOLD

Aucun produit n'a ete publie ou rendu achetable dans cette couche.

Les pages legales affichent les indicateurs de controle: `0 article sans preuve` et `91 fiches en controle`. Les produits incomplets restent en brouillon/HOLD.

## Tests et audits

- `rg` anti-fuite sur les pages legales, composants et donnees legales: OK, aucun terme interdit cote client.
- `npx eslint` cible sur les fichiers modifies: OK.
- `npm run typecheck`: OK.
- `npm run catalog:audit-public-dropshipping-surface`: OK.
- `npm run catalog:audit-public-catalog-source-guards`: OK.
- `npm run catalog:audit-checkout-eligibility`: OK.
- `npm run catalog:audit-seo-hold-visibility`: OK.
- `npm run catalog:audit-generated-artifact-leaks`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.

## Verification navigateur mobile

Serveur local temporaire: `http://localhost:3266`, arrete apres verification.

Viewport mobile teste: 390 x 844.

Routes verifiees:

- `/conditions-generales-vente`: H1 OK, support sous controle visible, cadre client visible, indicateurs HOLD visibles, aucun terme interdit, aucun overflow horizontal, aucun warning/error console.
- `/mentions-legales`: H1 OK, support sous controle visible, cadre client visible, indicateurs HOLD visibles, aucun terme interdit, aucun overflow horizontal, aucun warning/error console.
- `/politique-confidentialite`: H1 OK, support sous controle visible, cadre client visible, indicateurs HOLD visibles, aucun terme interdit, aucun overflow horizontal, aucun warning/error console.

Captures conservees:

- `tmp-next-couche-342-cgv-mobile.png`
- `tmp-next-couche-342-mentions-mobile.png`
- `tmp-next-couche-342-confidentialite-mobile.png`

## Suite conseillee

Continuer avec une couche surface boutique/categories: relier davantage les pages confiance aux parcours produits partenaires visibles, tout en gardant les fiches sans preuves en HOLD.
