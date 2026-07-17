# Test Stripe webhook stock idempotence

Date: 2026-06-12T03:35:56.725Z

Status: OK

## Summary

- Checks: 9
- Failures: 0
- Data restored: true
- Dev server stopped: true

## Checks

- OK fixture_written - Fixture produit et commande temporaire ajoutees avant le serveur.
- OK dev_server_ready - Next dev local pret avec secrets webhook factices.
- OK first_webhook_accepted - Premier webhook signe accepte localement.
- OK first_webhook_decrements_stock - Stock fixture passe de 7 a 5 apres quantite 2.
- OK order_marked_paid_done - Commande marquee payee avec stockDecrementStatus done.
- OK second_webhook_accepted - Second webhook signe accepte comme retry/replay local.
- OK second_webhook_is_idempotent - Le replay ne redecremente pas le stock deja traite.
- OK data_files_restored - quick-products.json et dropshipping-orders.json sont revenus a leur contenu initial exact.
- OK dev_server_stopped - Le serveur Next temporaire a ete stoppe apres le test.

## Runtime

- Port local: 3042
- Premier webhook: 200
- Second webhook: 200
- Stock initial: 7
- Stock apres premier webhook: 5
- Stock apres second webhook: 5

## Safety

- localOnly: true
- fakeStripeSecretsOnly: true
- noStripeNetworkCall: true
- noPayment: true
- noSupplierOrder: true
- noPublication: true
- dataRestoredAfterTest: true


