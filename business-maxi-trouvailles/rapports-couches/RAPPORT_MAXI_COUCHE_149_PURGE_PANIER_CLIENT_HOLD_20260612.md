# Rapport couche 149 - Purge panier client HOLD

Date: 2026-06-12
Statut: HOLD public maintenu

## Objectif

Eviter qu'un ancien panier local affiche encore une fiche devenue brouillon, HOLD, test, non publique ou non achetable. Cela reduit le risque de voir sur mobile une image ou un article qui ne correspond plus a une offre vendable.

## Modifications integrees

- `src/components/CartProvider.tsx`: ajout d'un chargement complet des produits rapides avant purge du panier local.
- `src/components/CartProvider.tsx`: purge automatique des lignes dont le produit n'existe plus ou n'est plus `isProductPurchasable`.
- `src/components/CartProvider.tsx`: clamp automatique des quantites stockees sur le stock actuel.
- `src/components/CartProvider.tsx`: `detailedItems` masque aussi les lignes non achetables avant rendu, pour eviter un affichage transitoire d'une ancienne fiche.
- `scripts/automation/audit_checkout_eligibility.mjs`: l'audit checkout controle maintenant la purge panier client, l'attente du chargement produits rapides, le clamp quantite et le masquage des lignes non achetables.

## Produits

- Produit ajoute: 0.
- Produit publie: 0.
- Produit rendu achetable: 0.
- Produit corrige: 0 fiche catalogue; correction comportement panier uniquement.

## Preuves et controles

- `npm run catalog:audit-checkout-eligibility`: OK.
  - totalProducts: 67
  - expectedPurchasableCount: 0
  - failureCount: 0
  - guardFailures: 0
  - nouveaux guards panier: OK.
- `npm run catalog:test-checkout-guards`: OK.
  - caseCount: 11
  - passedCount: 11
  - failedCount: 0
  - aucune session Stripe creee.
- `npm run lint`: OK apres correction React `set-state-in-effect`.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Verification navigateur mobile Playwright tentee sur `/panier` avec ancien panier force: resultat non exploitable car le controle a bloque et a ete stoppe par timeout. Les ports de test `3068` et `3069` ont ete nettoyes et verifies libres.

## Sauvegardes

- Avant couche: `backups/couche-149-cart-client-purge-pre-20260611-235918`.
- Apres couche: `backups/couche-149-cart-client-purge-final-20260612-000653`.

## Limites

- Cette couche ne remplace pas la validation image/fournisseur produit par produit.
- Aucun produit n'est debloque tant que les preuves exactes ne sont pas remplies.
- La verification navigateur automatique devra etre relancee dans une couche suivante avec un scenario plus court ou un navigateur deja stable.

## Prochaine action recommandee

Relancer une couche visuels/preuves terrain: produire ou deposer les premiers WebP exacts P0, puis relancer `catalog:audit-sprint-image-local-files`, `catalog:audit-sprint-image-human-review`, `catalog:audit-public-dropshipping-surface` et `catalog:audit-checkout-eligibility`.
