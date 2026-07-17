# Audit intake packets sourcing integration

Date: 2026-06-13T12:11:43.797Z

## Synthese

- Packets audites: 10
- Prets revue humaine HOLD: 0
- En HOLD preuves/images manquantes: 10
- Fichiers WebP attendus: 30
- Fichiers WebP valides: 0
- Statut global: HOLD_MISSING_EVIDENCE

## Tableau

| # | Produit | Statut | Preuves | Images OK | Prochaine action |
|---|---|---|---:|---:|---|
| 1 | Housse protection canape animal | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 2 | Cache multiprise boite rangement cables | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 3 | Trousse toilette suspendue voyage | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 4 | Etagere douche angle adhesive | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 5 | Boite a the compartiments bambou | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 6 | Organisateur coffre voiture pliable | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 7 | Organisateur tiroir cuisine extensible | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 8 | Sacs compression voyage lot | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 9 | Sac repas isotherme pliable | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |
| 10 | Boite rangement medicaments vide | HOLD_IMAGES_OR_EVIDENCE_MISSING | 1/10 | 0/3 | Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus. |

## Garde-fous

- Lecture seule cote catalogue.
- Aucun fournisseur contacte automatiquement.
- Aucun paiement, achat, commande ou publication.
- Le statut `READY_FOR_HUMAN_REVIEW_HOLD` ne publie rien; il ouvre seulement une revue humaine.

## Bloquants

- exact_product_url_missing: 10
- partner_name_missing: 10
- supplier_sku_missing: 10
- exact_variant_missing: 10
- supplier_price_missing: 10
- supplier_stock_missing: 10
- delivery_france_europe_missing: 10
- tracking_not_confirmed: 10
- image_rights_missing: 10
- mouss_validation_missing: 10
- image_missing: 30

