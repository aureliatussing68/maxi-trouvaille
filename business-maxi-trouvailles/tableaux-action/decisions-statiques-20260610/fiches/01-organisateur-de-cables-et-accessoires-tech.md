# Decision statique - Organisateur de câbles et accessoires tech

Priorite: 1
Produit: prod_partner_cable_organizer_001
Categorie: dropshipping-accessoires
Statut actuel: HOLD_MISSING_EVIDENCE
Recommandation par defaut: later

## Pourquoi cette decision existe

lien fournisseur non exact | SKU fournisseur manquant | images et droits non prouves

## Contexte fournisseur interne

- URL fournisseur interne: https://www.aliexpress.com/wholesale?SearchText=cable+organizer+bag+travel+electronics
- URL exacte: non
- SKU fournisseur: a verifier
- Prix fournisseur: 4.00 EUR
- Prix boutique: 12.90 EUR
- Stock fournisseur: 30
- Delai actuel: 8 a 15 jours ouvres

## Options

| Valeur | Choix | Resultat |
|---|---|---|
| keep_validate | Garder et verifier | HOLD jusqu'a preuves completes et validation humaine. |
| replace | Remplacer | HOLD, aucune suppression ni publication automatique. |
| remove | Retirer | HOLD, retrait a appliquer seulement apres validation explicite. |
| later | Plus tard | HOLD sans action catalogue. |

## Bloc a remplir

```json
{
  "productId": "prod_partner_cable_organizer_001",
  "productName": "Organisateur de câbles et accessoires tech",
  "checkedAt": "",
  "decision": "",
  "decisionOptions": [
    "keep_validate",
    "replace",
    "remove",
    "later"
  ],
  "reason": "",
  "ifKeepValidate": {
    "exactSupplierProductUrl": "",
    "supplierSellerName": "",
    "supplierSku": "",
    "exactVariantChosen": "",
    "supplierPriceCents": 400,
    "supplierStock": 30,
    "deliveryFranceEuropeProof": "",
    "deliveryEstimateForCustomer": "",
    "trackingAvailable": "",
    "pricingProof": "",
    "shippingProof": "",
    "imageProof": "",
    "imageRightsProof": ""
  },
  "ifReplace": {
    "replacementProductIdea": "",
    "targetCategory": "dropshipping-accessoires",
    "reasonReplacementCouldSell": "",
    "quickSupplierSearchNotes": ""
  },
  "ifRemove": {
    "removeReason": "",
    "keepHistoricalNote": true
  },
  "ifLater": {
    "revisitAfter": "",
    "blockingReason": ""
  },
  "finalDecision": "HOLD",
  "reviewedByMouss": false
}
```

## Garde-fous

- Ce fichier ne publie rien.
- Ce fichier ne modifie pas le catalogue.
- Ce fichier ne commande pas fournisseur.
- Ce fichier ne lance aucun paiement.
- Les liens fournisseur restent internes et ne doivent jamais apparaitre cote client.

