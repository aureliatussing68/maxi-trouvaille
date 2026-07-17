# Rapport Maxi - Couche 002 - Produits partenaires

Date : 2026-05-27

## Résumé
- Front public orienté Produits partenaires : le mot dropshipping n'est plus affiché côté client.
- Rayons colis perdu / colis surprise / palettes masqués du site public pour éviter le mélange.
- 10 produits partenaires AliExpress ajoutés et publiés en nouveauté.
- Prix de vente calculé avec environ +40% sur le prix fournisseur estimé.
- Aucun achat fournisseur, aucune commande, aucun paiement réel, aucune clé affichée.

## Produits ajoutés
- Support téléphone voiture 360° : 9,70 € fournisseur estimé -> 13,60 € vente.
- Lot 2 lampes LED détection mouvement USB : 5,40 € -> 7,60 €.
- Brosse anti-poils animaux réutilisable : 7,89 € -> 11,10 €.
- Support ordinateur portable pliant aluminium : 11,80 € -> 16,60 €.
- Sacs rangement sous vide voyage : 5,30 € -> 7,50 €.
- Mini humidificateur USB bureau & maison : 3,60 € -> 5,10 €.
- Pochette rangement câbles voyage : 11,00 € -> 15,40 €.
- Gourde pliable silicone voyage : 3,70 € -> 5,20 €.
- Tapis silicone anti-éclaboussures évier : 5,00 € -> 7,00 €.
- Filet rangement coffre voiture : 4,00 € -> 5,60 €.

## Emplacements
- Nouveautés : `/categories/dropshipping-nouveautes`
- Produits partenaires : `/dropshipping`
- Catégories réelles : Auto/Moto, Maison, Animaux, High-tech, Accessoires, Cuisine.

## Fichiers touchés
- `data/quick-products.json`
- `scripts/automation/import_aliexpress_partner_products.mjs`
- `src/lib/catalog.ts`
- `src/lib/catalog-server.ts`
- Pages et composants publics : header, footer, accueil, boutique, catégories, produit, livraison, FAQ, conditions.

## Vérifications
- `npm run typecheck` : OK
- `npm run lint` : OK
- `npm run build` : OK
- HTTP local : `/categories`, `/dropshipping`, `/categories/dropshipping-nouveautes`, fiche produit : OK 200.
- Vérification navigateur Edge headless : desktop/mobile OK, aucun texte visible "Dropshipping" ou "colis perdu".

## Captures
- `logs/screenshots/nouveautes-desktop-couche-002-final-20260527.png`
- `logs/screenshots/nouveautes-mobile-couche-002-final-20260527.png`

## Sauvegarde
- `business-maxi-trouvailles/sauvegardes/couche_002_partenaires_aliexpress_20260527_115543`

## À faire ensuite
- Remplacer les visuels temporaires de certains produits par de vraies images validées.
- Valider manuellement fournisseurs, variantes, délais, stocks et conformité.
- Préparer une page publique `/produits-partenaires` en alias propre si souhaité.
