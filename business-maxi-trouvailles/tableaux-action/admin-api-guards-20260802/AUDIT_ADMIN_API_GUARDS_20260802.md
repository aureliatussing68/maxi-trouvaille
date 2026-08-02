# Audit admin API guards

Date: 2026-08-02T12:43:18.914Z

Status: OK

## Summary

- Routes controlees: 11
- Methodes controlees: 15
- Echecs: 0

## Routes

- OK src/app/api/admin/dropshipping/import/route.ts (POST)
- OK src/app/api/admin/dropshipping/orders/[orderId]/route.ts (PATCH)
- OK src/app/api/admin/dropshipping/orders/route.ts (GET)
- OK src/app/api/admin/dropshipping/sync/route.ts (GET, POST)
- OK src/app/api/admin/messages/[messageId]/route.ts (PATCH)
- OK src/app/api/admin/products/[slug]/image/route.ts (PATCH)
- OK src/app/api/admin/products/[slug]/route.ts (GET, PATCH)
- OK src/app/api/admin/products/decrement/route.ts (POST)
- OK src/app/api/admin/products/photo-analysis/route.ts (POST)
- OK src/app/api/admin/products/route.ts (GET, POST)
- OK src/app/api/admin/reviews/[reviewId]/route.ts (PATCH, DELETE)

## Echecs

- Aucun

## Safety

- readOnlyAudit: true
- noCatalogWrite: true
- noPayment: true
- noSupplierOrder: true
- noMessageSent: true

