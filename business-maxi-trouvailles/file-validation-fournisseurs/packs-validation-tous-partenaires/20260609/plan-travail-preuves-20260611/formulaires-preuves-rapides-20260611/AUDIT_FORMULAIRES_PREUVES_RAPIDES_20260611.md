# Audit formulaires preuves rapides

Date locale: 2026-06-11 06:48 Europe/Paris

## Synthese

- Formulaires analyses: 5
- Prets revue humaine: 0
- Bloques: 5

## Bloquants

- date_verification_absente: 5
- decision_finale_pas_ready_review: 5
- delai_client_absent: 5
- nom_vendeur_fournisseur_absent: 5
- preuve_delai_france_europe_absente: 5
- preuve_droits_images_absente: 5
- preuve_image_exacte_absente: 5
- preuve_livraison_absente: 5
- preuve_prix_absente: 5
- revue_mouss_absente: 5
- tracking_non_confirme: 5
- variante_exacte_absente: 5

## Produits

| Priorite | Statut | Produit | Bloquants | Details |
|---:|---|---|---:|---|
| 5 | HOLD_MISSING_EVIDENCE | Pochette organisateur câbles double couche voyage | 12 | date_verification_absente, nom_vendeur_fournisseur_absent, variante_exacte_absente, delai_client_absent, tracking_non_confirme, preuve_delai_france_europe_absente, preuve_prix_absente, preuve_livraison_absente, preuve_image_exacte_absente, preuve_droits_images_absente, decision_finale_pas_ready_review, revue_mouss_absente |
| 6 | HOLD_MISSING_EVIDENCE | Support PC portable pliant aluminium ajustable | 12 | date_verification_absente, nom_vendeur_fournisseur_absent, variante_exacte_absente, delai_client_absent, tracking_non_confirme, preuve_delai_france_europe_absente, preuve_prix_absente, preuve_livraison_absente, preuve_image_exacte_absente, preuve_droits_images_absente, decision_finale_pas_ready_review, revue_mouss_absente |
| 7 | HOLD_MISSING_EVIDENCE | Filet rangement coffre voiture à sangles fixes | 12 | date_verification_absente, nom_vendeur_fournisseur_absent, variante_exacte_absente, delai_client_absent, tracking_non_confirme, preuve_delai_france_europe_absente, preuve_prix_absente, preuve_livraison_absente, preuve_image_exacte_absente, preuve_droits_images_absente, decision_finale_pas_ready_review, revue_mouss_absente |
| 8 | HOLD_MISSING_EVIDENCE | Gourde pliable silicone voyage avec mousqueton | 12 | date_verification_absente, nom_vendeur_fournisseur_absent, variante_exacte_absente, delai_client_absent, tracking_non_confirme, preuve_delai_france_europe_absente, preuve_prix_absente, preuve_livraison_absente, preuve_image_exacte_absente, preuve_droits_images_absente, decision_finale_pas_ready_review, revue_mouss_absente |
| 9 | HOLD_MISSING_EVIDENCE | Lampe LED à détection de mouvement USB rechargeable | 12 | date_verification_absente, nom_vendeur_fournisseur_absent, variante_exacte_absente, delai_client_absent, tracking_non_confirme, preuve_delai_france_europe_absente, preuve_prix_absente, preuve_livraison_absente, preuve_image_exacte_absente, preuve_droits_images_absente, decision_finale_pas_ready_review, revue_mouss_absente |

## Regles

- Audit en lecture seule.
- `ready_review_hold` ne publie rien: cela veut seulement dire que Mouss peut relire le dossier.
- Paiement, commande fournisseur et publication restent interdits sans validation explicite.

