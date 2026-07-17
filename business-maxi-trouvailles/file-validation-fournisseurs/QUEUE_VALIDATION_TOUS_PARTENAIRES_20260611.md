# File validation tous partenaires - Maxi Trouvaille

Date: 2026-06-11T22:30:07.515Z

## Synthese

- Produits partenaires analyses: 49
- Produits en HOLD: 49
- Produits statiques a decider: 4
- Top prioritaire: 15

## Files

- lane_0_static_partner_decision: 4
- lane_1_fast_supplier_validation: 25
- lane_2_delivery_price_rights: 20

## Top prioritaire

| # | Produit | Origine | File | Score | Preuves manquantes |
|---|---|---|---|---:|---|
| 1 | Organisateur de câbles et accessoires tech | src/lib/catalog.ts | lane_0_static_partner_decision | 106 | decision_garder_remplacer_ou_retirer, lien_fournisseur_exact, sku_fournisseur, images_exactes_et_droits |
| 2 | Mini imprimante thermique Bluetooth | src/lib/catalog.ts | lane_0_static_partner_decision | 102 | decision_garder_remplacer_ou_retirer, lien_fournisseur_exact, sku_fournisseur, images_exactes_et_droits |
| 3 | Projecteur galaxie LED pour ambiance | src/lib/catalog.ts | lane_0_static_partner_decision | 99 | decision_garder_remplacer_ou_retirer, lien_fournisseur_exact, sku_fournisseur, images_exactes_et_droits |
| 4 | Mini aspirateur voiture sans fil | src/lib/catalog.ts | lane_0_static_partner_decision | 96 | decision_garder_remplacer_ou_retirer, lien_fournisseur_exact, sku_fournisseur, images_exactes_et_droits |
| 5 | Pochette organisateur câbles double couche voyage | data/quick-products.json | lane_1_fast_supplier_validation | 118 | preuve_delai_france_europe |
| 6 | Support PC portable pliant aluminium ajustable | data/quick-products.json | lane_1_fast_supplier_validation | 118 | preuve_delai_france_europe |
| 7 | Filet rangement coffre voiture à sangles fixes | data/quick-products.json | lane_1_fast_supplier_validation | 115 | preuve_delai_france_europe |
| 8 | Gourde pliable silicone voyage avec mousqueton | data/quick-products.json | lane_1_fast_supplier_validation | 115 | preuve_delai_france_europe |
| 9 | Lampe LED à détection de mouvement USB rechargeable | data/quick-products.json | lane_1_fast_supplier_validation | 115 | preuve_delai_france_europe |
| 10 | Support téléphone voiture flexible à ventouse 360° | data/quick-products.json | lane_1_fast_supplier_validation | 101 | preuve_delai_france_europe, preuve_prix, preuve_livraison |
| 11 | Corde paracorde camping randonnée 5/15/30 m | data/quick-products.json | lane_1_fast_supplier_validation | 100 | preuve_delai_france_europe, droits_images, preuve_prix, preuve_livraison |
| 12 | Nano tape double-face salle de bain cuisine | data/quick-products.json | lane_1_fast_supplier_validation | 100 | preuve_delai_france_europe, droits_images, preuve_prix, preuve_livraison |
| 13 | Organisateur câbles 1/5 m bureau best-seller | data/quick-products.json | lane_1_fast_supplier_validation | 100 | preuve_delai_france_europe, droits_images, preuve_prix, preuve_livraison |
| 14 | Ruban double-face puissant maison promo | data/quick-products.json | lane_1_fast_supplier_validation | 100 | preuve_delai_france_europe, droits_images, preuve_prix, preuve_livraison |
| 15 | Sac banane sport étanche randonnée | data/quick-products.json | lane_1_fast_supplier_validation | 100 | preuve_delai_france_europe, droits_images, preuve_prix, preuve_livraison |

## Preuves manquantes globales

- decision_garder_remplacer_ou_retirer: 4
- lien_fournisseur_exact: 18
- sku_fournisseur: 16
- images_exactes_et_droits: 16
- preuve_delai_france_europe: 45
- preuve_prix: 24
- preuve_livraison: 25
- droits_images: 23
- prix_fournisseur: 12
- stock_fournisseur: 12

## Regle

Chaque fiche reste en HOLD tant que fournisseur exact, SKU, prix, stock, delai, variante, images exactes et droits images ne sont pas prouves.

