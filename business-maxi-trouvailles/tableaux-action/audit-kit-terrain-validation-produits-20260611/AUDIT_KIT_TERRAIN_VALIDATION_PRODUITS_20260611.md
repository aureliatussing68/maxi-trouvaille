# Maxi Trouvailles - Audit kit terrain validation produits

Date locale: 2026-06-11 08:25 Europe/Paris
Statut: HOLD_FIELD_KIT_INCOMPLETE

## Synthese

- Produits controles: 3
- Produits prets revue humaine HOLD: 0
- Produits en HOLD: 3
- Preuves manquantes/invalides: 36
- Images manquantes/invalides: 14
- Fichiers WebP manquants: 14
- Warnings: 0
- Publication: bloquee.
- Paiement: bloque.
- Commande fournisseur: bloquee.

## Produits

| Produit | Statut | Preuves OK | Images OK | Blocages | Prochaine action |
|---|---|---:|---:|---:|---|
| Pochette organisateur câbles double couche voyage | HOLD_FIELD_KIT_INCOMPLETE | 0/12 | 0/4 | 23 | remplir toutes les preuves, deposer les WebP exacts, puis relancer cet audit |
| Support PC portable pliant aluminium ajustable | HOLD_FIELD_KIT_INCOMPLETE | 0/12 | 0/4 | 23 | remplir toutes les preuves, deposer les WebP exacts, puis relancer cet audit |
| Filet rangement coffre voiture à sangles fixes | HOLD_FIELD_KIT_INCOMPLETE | 0/12 | 0/6 | 27 | remplir toutes les preuves, deposer les WebP exacts, puis relancer cet audit |

## Blocages principaux

| Produit | Blocage |
|---|---|
| Pochette organisateur câbles double couche voyage | checkedAt:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | supplierSellerName:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | exactVariantChosen:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | deliveryFranceEuropeProof:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | deliveryEstimateForCustomer:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | trackingAvailable:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | trackingAvailable:tracking_answer_not_clear_yes_no |
| Pochette organisateur câbles double couche voyage | pricingProof:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | shippingProof:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | imageProof:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | imageRightsProof:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | finalDecision:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | finalDecision:final_decision_not_ready_review |
| Pochette organisateur câbles double couche voyage | reviewedByMouss:missing_or_placeholder |
| Pochette organisateur câbles double couche voyage | reviewedByMouss:missing_human_review_mouss |
| Pochette organisateur câbles double couche voyage | main:missing_image_proof |
| Pochette organisateur câbles double couche voyage | main:missing_webp_file |
| Pochette organisateur câbles double couche voyage | detail:missing_image_proof |
| Support PC portable pliant aluminium ajustable | checkedAt:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | supplierSellerName:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | exactVariantChosen:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | deliveryFranceEuropeProof:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | deliveryEstimateForCustomer:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | trackingAvailable:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | trackingAvailable:tracking_answer_not_clear_yes_no |
| Support PC portable pliant aluminium ajustable | pricingProof:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | shippingProof:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | imageProof:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | imageRightsProof:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | finalDecision:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | finalDecision:final_decision_not_ready_review |
| Support PC portable pliant aluminium ajustable | reviewedByMouss:missing_or_placeholder |
| Support PC portable pliant aluminium ajustable | reviewedByMouss:missing_human_review_mouss |
| Support PC portable pliant aluminium ajustable | main:missing_image_proof |
| Support PC portable pliant aluminium ajustable | main:missing_webp_file |
| Support PC portable pliant aluminium ajustable | detail:missing_image_proof |
| Filet rangement coffre voiture à sangles fixes | checkedAt:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | supplierSellerName:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | exactVariantChosen:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | deliveryFranceEuropeProof:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | deliveryEstimateForCustomer:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | trackingAvailable:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | trackingAvailable:tracking_answer_not_clear_yes_no |
| Filet rangement coffre voiture à sangles fixes | pricingProof:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | shippingProof:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | imageProof:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | imageRightsProof:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | finalDecision:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | finalDecision:final_decision_not_ready_review |
| Filet rangement coffre voiture à sangles fixes | reviewedByMouss:missing_or_placeholder |
| Filet rangement coffre voiture à sangles fixes | reviewedByMouss:missing_human_review_mouss |
| Filet rangement coffre voiture à sangles fixes | main:missing_image_proof |
| Filet rangement coffre voiture à sangles fixes | main:missing_webp_file |
| Filet rangement coffre voiture à sangles fixes | detail:missing_image_proof |

## Regles controlees

- Decision finale requise: `READY_REVIEW`.
- Validation Mouss obligatoire.
- Images exactes: preuve renseignee, fichier WebP present, signature valide, taille suffisante.
- Les chemins images doivent rester dans `business-maxi-trouvailles/depots-photos` ou `public/uploads/partner-products`.
- Les images generees ne debloquent jamais une galerie produit exacte.
- Cet audit reste en lecture seule et ne publie rien.

## Sources

- Kit terrain: business-maxi-trouvailles\tableaux-action\kit-terrain-validation-produits-20260611\KIT_TERRAIN_VALIDATION_PRODUITS_20260611.json
- Fichier a remplir: business-maxi-trouvailles\tableaux-action\kit-terrain-validation-produits-20260611\A_REMPLIR_TOUTES_PREUVES_IMAGES_20260611.json

