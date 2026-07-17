# Maxi Trouvailles - Audit gates images sprint

Date locale: 2026-06-11 14:51 Europe/Paris

## Synthese

- Produits controles: 3
- Revue image autorisee: 0
- Revue image bloquee: 3
- Images domaine fournisseur dans catalogue: 14
- Fichiers locaux manquants: 14
- Echecs durs: 0

## Gates

| Produit | Statut produit | Gate | Images fournisseur | Locaux manquants | Catalogue local | Bloquants |
|---|---|---|---:|---:|---:|---|
| Pochette organisateur câbles double couche voyage | draft | BLOCK_REVIEW_IMAGE_GATE | 4 | 4 | 0/4 | catalogue_pointe_encore_vers_domaine_fournisseur, fichiers_webp_locaux_manquants, fichiers_webp_locaux_non_prets, catalogue_pas_encore_aligne_sur_images_locales, image_principale_pas_locale_cible, decision_droits_images_absente |
| Support PC portable pliant aluminium ajustable | draft | BLOCK_REVIEW_IMAGE_GATE | 4 | 4 | 0/4 | catalogue_pointe_encore_vers_domaine_fournisseur, fichiers_webp_locaux_manquants, fichiers_webp_locaux_non_prets, catalogue_pas_encore_aligne_sur_images_locales, image_principale_pas_locale_cible, decision_droits_images_absente |
| Filet rangement coffre voiture à sangles fixes | draft | BLOCK_REVIEW_IMAGE_GATE | 6 | 6 | 0/6 | catalogue_pointe_encore_vers_domaine_fournisseur, fichiers_webp_locaux_manquants, fichiers_webp_locaux_non_prets, catalogue_pas_encore_aligne_sur_images_locales, image_principale_pas_locale_cible, decision_droits_images_absente |

## Regle

- `BLOCK_REVIEW_IMAGE_GATE` bloque la revue humaine et la publication.
- Un produit publie avec domaine fournisseur image serait un echec dur.
- L'audit reste en lecture seule et ne modifie pas le catalogue.

## Sources

- Plan local images: C:\Users\sinek\Desktop\maxi-trouvaille\business-maxi-trouvailles\tableaux-action\plan-local-images-sprint-20260611\PLAN_LOCAL_IMAGES_SPRINT_20260611.json
- Catalogue brouillons rapides: C:\Users\sinek\Desktop\maxi-trouvaille\data\quick-products.json

