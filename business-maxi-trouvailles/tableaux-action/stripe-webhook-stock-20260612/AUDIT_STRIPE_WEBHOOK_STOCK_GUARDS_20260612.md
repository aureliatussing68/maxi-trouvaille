# Audit Stripe webhook stock guards

Date: 2026-06-12T07:54:39.002Z

Status: OK

## Summary

- Checks: 17
- Failures: 0

## Checks

- OK webhook_node_runtime - Le webhook Stripe reste en runtime Node pour la verification de signature.
- OK webhook_force_dynamic - Le webhook n'est jamais prerendu ni cache.
- OK stripe_signature_required - La signature Stripe est obligatoire avant traitement.
- OK stripe_construct_event - Le body brut est verifie avec le secret webhook.
- OK checkout_completed_only - Le traitement commande part uniquement d'un checkout.session.completed signe.
- OK dropshipping_metadata_required - Le decrement stock ne concerne que les sessions marquees dropshipping.
- OK server_marks_paid - Le webhook appelle le helper serveur de commande dropshipping.
- OK webhook_returns_retryable_error - Un echec de stock renvoie une erreur serveur pour permettre une reprise.
- OK success_page_no_admin_decrement - La page succes paiement ne decremente jamais le stock via une route admin.
- OK stock_status_type_exists - Les etats stock webhook sont traces dans le type commande.
- OK draft_starts_pending_payment - Une commande creee avant paiement part en attente de paiement.
- OK server_uses_local_stock_decrement - Le stock est ajuste cote serveur local, sans appel client.
- OK idempotence_guard_before_decrement - Les statuts done/skipped ou stockDecrementedAt sont controles avant decrement.
- OK legacy_paid_orders_are_skipped - Les anciennes commandes deja payees sans trace stock ne sont pas redecrementees.
- OK done_status_after_success - Un succes de webhook trace la source, la date et le statut done.
- OK failed_status_and_retry - Un echec stock est trace en failed et reste retryable.
- OK no_supplier_or_payment_side_effect - Le helper paye/stock ne commande pas chez un fournisseur et ne contacte aucun service externe.

## Safety

- readOnlyAudit: true
- noPayment: true
- noSupplierOrder: true
- noAdminClientDecrement: true
- noExternalApiCall: true
- noSecretsCopied: true

