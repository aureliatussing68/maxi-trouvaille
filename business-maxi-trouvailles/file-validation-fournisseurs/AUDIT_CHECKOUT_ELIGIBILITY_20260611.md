# Audit checkout eligibility

Date: 2026-06-11T23:56:11.925Z

Status: OK

## Summary

- Products analyzed: 91
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
- purchasableDelegatesPublicProduct: true
- catalogPublicReadinessGatePresent: true
- purchasableChecksPublishedStatus: true
- purchasableChecksStock: true
- purchasableChecksComingSoon: true
- purchasableBlocksTestProducts: true
- purchasableChecksPublicCategory: true
- purchasableChecksDropshippingFocus: true
- cartProviderBlocksAddItem: true
- cartProviderBlocksUpdateQuantity: true
- cartProviderWaitsQuickProductsBeforeStoragePurge: true
- cartProviderPurgesUnavailableStoredItems: true
- cartProviderClampsStoredQuantities: true
- cartProviderDetailedItemsHideUnavailableProducts: true
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

- By status: {"published":4,"draft":87}
- By category: {"palettes-destockage":1,"colis-au-poids":1,"colis-mysteres":1,"lots-bonnes-affaires":1,"espace-revendeur":1,"dropshipping-high-tech":6,"dropshipping-accessoires":12,"dropshipping-maison":10,"dropshipping-auto-moto":7,"high-tech":2,"dropshipping-animaux":5,"dropshipping-cuisine":7,"dropshipping-beaute":6,"dropshipping-mode":4,"dropshipping-enfant":4,"electricite":5,"informatique":1,"maison":2,"sport-loisirs":2,"beaute-sante":2,"auto-moto":8,"animaux":1,"mannequins-bustes":2}

## Safety

- readOnlyAudit: true
- noCatalogWrite: true
- noPublication: true
- noPayment: true
- noSupplierOrder: true

