# Guide preuve fournisseur - Organisateur de câbles et accessoires tech

Priorite: 1
File: A_DECISION_STATIQUE
Origine: src/lib/catalog.ts
Statut: HOLD_MISSING_EVIDENCE

## Donnees utiles

- ID: prod_partner_cable_organizer_001
- Slug: organisateur-cables-voyage-tech
- Categorie: dropshipping-accessoires
- URL fournisseur actuelle: https://www.aliexpress.com/wholesale?SearchText=cable+organizer+bag+travel+electronics
- URL exacte: false
- SKU fournisseur: a verifier
- Prix fournisseur: 400
- Prix boutique: 1290
- Stock fournisseur: 30
- Delai actuel: 8 a 15 jours ouvres

## Champs a remplir

- decision
- exactSupplierProductUrl si garder
- supplierSku si garder
- checkedAt
- supplierSellerName
- exactVariantChosen
- deliveryFranceEuropeProof
- deliveryEstimateForCustomer
- trackingAvailable
- pricingProof
- shippingProof
- imageProof
- imageRightsProof
- finalDecision
- reviewedByMouss
- complianceNotes si remplacer/retirer/plus tard

## Etapes

1. Choisir une decision: keep_validate, replace, remove ou later.
2. Si keep_validate: remplacer la recherche fournisseur par une URL article exacte.
3. Renseigner SKU fournisseur, vendeur exact, variante exacte et preuves image.
4. Si replace/remove/later: remplir complianceNotes avec la raison et garder HOLD.
5. Ne jamais publier depuis ce guide.

## Bloquants actuels

- date_verification_absente
- decision_absente
- url_produit_exacte_absente
- nom_vendeur_fournisseur_absent
- sku_fournisseur_absent
- variante_exacte_absente
- delai_client_absent
- tracking_non_confirme
- preuve_delai_france_europe_absente
- preuve_prix_absente
- preuve_livraison_absente
- preuve_image_exacte_absente
- preuve_droits_images_absente
- revue_mouss_absente
- decision_garder_valider_absente
- decision_finale_pas_ready_review

## Garde-fous

- Ne pas publier.
- Ne pas payer.
- Ne pas commander fournisseur.
- Garder en HOLD tant que les preuves et la revue Mouss ne sont pas completes.

