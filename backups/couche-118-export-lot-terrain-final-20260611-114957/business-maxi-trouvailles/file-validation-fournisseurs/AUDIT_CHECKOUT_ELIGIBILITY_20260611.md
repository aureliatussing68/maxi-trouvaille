# Audit checkout eligibility

Date: 2026-06-11T09:47:16.085Z

Status: OK

## Summary

- Products analyzed: 67
- Public dropshipping purchasable products: 0
- Legacy purchasable products before public dropshipping focus: 0
- Products that would be risky without strict guards: 0
- Guard failures: 0
- Failure count: 0

## Legacy risk products

- Aucun

## Guard failures

- Aucun

## Source guards

- hasPurchasableFunction: true
- purchasableChecksPublishedStatus: true
- purchasableChecksStock: true
- purchasableChecksComingSoon: true
- purchasableBlocksTestProducts: true
- purchasableChecksPublicCategory: true
- purchasableChecksDropshippingFocus: true
- cartProviderBlocksAddItem: true
- cartProviderBlocksUpdateQuantity: true
- checkoutViewBlocksUnavailableItems: true
- apiRejectsUnavailableProducts: true
- apiRejectsDuplicateProductIds: true
- apiRejectsNonInternalProducts: true
- apiRejectsOverStockQuantity: true
- apiValidatesShippingSelection: true
- apiRecordsDropshippingDraft: true
- apiRequiresValidStripeMode: true
- checkoutDoesNotExposeSupplierUrl: true

## Counts

- By status: {"published":4,"draft":63}
- By category: {"palettes-destockage":1,"colis-au-poids":1,"colis-mysteres":1,"lots-bonnes-affaires":1,"espace-revendeur":1,"dropshipping-high-tech":4,"dropshipping-accessoires":7,"dropshipping-maison":7,"dropshipping-auto-moto":5,"high-tech":2,"dropshipping-animaux":3,"dropshipping-cuisine":4,"dropshipping-beaute":3,"dropshipping-mode":2,"dropshipping-enfant":2,"electricite":5,"informatique":1,"maison":2,"sport-loisirs":2,"beaute-sante":2,"auto-moto":8,"animaux":1,"mannequins-bustes":2}

## Safety

- readOnlyAudit: true
- noCatalogWrite: true
- noPublication: true
- noPayment: true
- noSupplierOrder: true

