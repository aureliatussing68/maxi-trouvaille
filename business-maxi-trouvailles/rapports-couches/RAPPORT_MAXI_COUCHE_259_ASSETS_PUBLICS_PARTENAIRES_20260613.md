# Rapport couche 259 - Assets publics partenaires

Date locale: 2026-06-13 13:02 Europe/Paris

## Objectif

Nettoyer les chemins d'images visibles par le navigateur afin que la vitrine demo reste centree sur "produits partenaires" et ne laisse pas remonter d'anciens noms publics `dropshipping*.webp`.

## Changements integres

- Ajout non destructif de trois alias WebP publics:
  - `public/uploads/category-images/selection-partenaires.webp`
  - `public/uploads/category-images/nouveautes-partenaires.webp`
  - `public/uploads/category-images/promotions-partenaires.webp`
- Carousel d'accueil: bascule vers les chemins `selection-partenaires`, `nouveautes-partenaires` et `promotions-partenaires`.
- Mapping catalogue categories: les rayons partenaires et le rayon promotions caché pointent vers des chemins publics propres, sans ancien nom `dropshipping*.webp`.
- Anciennes routes `/dropshipping` et `/conditions-dropshipping` vérifiées: elles redirigent vers `/produits-partenaires` et `/conditions-produits-partenaires`.

## Verifications

- Scan source public ciblé OK: aucun chemin `/uploads/category-images/dropshipping*.webp` restant dans `src`.
- Scan liens publics ciblé OK: aucun lien visible vers `/dropshipping`.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit partenaire visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit achetable attendu.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK.
- Verification navigateur mobile 390px OK sur `/`, `/categories`, `/categories/produits-partenaires`, `/categories/nouveautes-partenaires`, `/categories/promotions-partenaires`: pas d'overflow horizontal, pas d'erreur console, aucun ancien asset `dropshipping` dans les images du DOM.
- Vérification HTTP directe OK: les trois nouveaux WebP répondent en `200 image/webp`.

## Garde-fous

- Aucun paiement, achat, commande fournisseur, message reel, connexion compte, publication production ou deploiement.
- Aucune fiche produit n'a ete publiee.
- Aucun ancien asset n'a ete supprime.
- Serveur local de verification arrete apres controle.
