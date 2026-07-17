# Audit checkout eligibility

Date: 2026-06-18T19:58:04.330Z

Status: OK

## Summary

- Products analyzed: 121
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
- catalogClientDoesNotImportCatalogValues: true
- cartProviderStoresOnlyCartLines: true
- cartProviderFetchesPublicEligibility: true
- cartProviderPurgesUnavailableStoredItems: true
- cartProviderClampsEligibleQuantities: true
- cartProviderAddItemStoresOnlyIds: true
- cartProviderUpdateQuantityDoesNotReadCatalog: true
- cartProviderDoesNotFetchAdminProducts: true
- cartProviderDoesNotHydrateQuickDrafts: true
- adminProductsApiRequiresAdminMode: true
- orderSuccessDoesNotCallAdminStockDecrement: true
- adminProductsDecrementRequiresAdminMode: true
- adminProductsPhotoAnalysisRequiresAdminMode: true
- cartProviderClampsStoredQuantities: true
- cartEligibilityApiUsesPublicPurchasableProducts: true
- cartEligibilityApiDoesNotExposeSensitiveFields: true
- cartPageProvidesPublicProducts: true
- paymentPageProvidesPublicProducts: true
- cartViewUsesPublicProductsProp: true
- cartViewDetailedItemsHideUnavailableProducts: true
- checkoutViewUsesPublicProductsProp: true
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

- By status: {"published":4,"draft":117}
- By category: {"palettes-destockage":1,"colis-au-poids":1,"colis-mysteres":1,"lots-bonnes-affaires":1,"espace-revendeur":1,"dropshipping-high-tech":8,"dropshipping-accessoires":18,"dropshipping-maison":17,"dropshipping-auto-moto":9,"high-tech":2,"dropshipping-animaux":9,"dropshipping-cuisine":15,"dropshipping-beaute":6,"dropshipping-mode":5,"dropshipping-enfant":4,"electricite":5,"informatique":1,"maison":2,"sport-loisirs":2,"beaute-sante":2,"auto-moto":8,"animaux":1,"mannequins-bustes":2}

## Safety

- readOnlyAudit: true
- noCatalogWrite: true
- noPublication: true
- noPayment: true
- noSupplierOrder: true

