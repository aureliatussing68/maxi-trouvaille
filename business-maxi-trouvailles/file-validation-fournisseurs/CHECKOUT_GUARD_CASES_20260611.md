# Checkout guard case tests

Date: 2026-06-11T22:55:47.487Z

Status: OK

## Summary

- Cases tested: 11
- Passed: 11
- Failed: 0
- Eligibility audit ok: true

## Cases

- OK empty_cart: API rejects empty cart before line item creation - Source contains empty cart branch and customer-safe error.
- OK duplicate_product: API rejects duplicate product IDs - Route uses seenProductIds before Stripe session creation.
- OK forced_test_product: Forced test product stays blocked - Test product is not expected purchasable and API calls isProductPurchasable.
- OK forced_reseller_test_product: Forced reseller test product stays blocked - Reseller test product is blocked by strict purchasable rule.
- OK forced_coming_soon_product: Forced coming-soon surprise product stays blocked - Coming-soon product is not expected purchasable and API checks availability.
- OK forced_draft_partner_product: Forced draft partner product stays blocked - Draft partner product remains HOLD before any checkout session.
- OK over_stock_quantity: API rejects quantity above product stock - No public purchasable product while dropshipping stays HOLD; route still compares requested quantity to product.stock.
- OK non_internal_source: API rejects non-internal marketplace source - Route blocks non-internal products until marketplace payment exists.
- OK shipping_required: API validates shipping selection before Stripe session creation - Route calls validateShippingSelection before checkout session create.
- OK no_supplier_leak: Checkout route does not expose supplier URLs to Stripe metadata - Route metadata stays Maxi Trouvaille / logistics partner only.
- OK live_payment_flag: Live Stripe mode requires explicit enable flag - Route requires STRIPE_ENABLE_LIVE_PAYMENTS before live payment mode.

## Failed cases

- Aucun

## Safety

- readOnlyAudit: true
- noStripeSessionCreated: true
- noPayment: true
- noSupplierOrder: true
- noPublication: true
- noNetworkCallFromThisScript: true

