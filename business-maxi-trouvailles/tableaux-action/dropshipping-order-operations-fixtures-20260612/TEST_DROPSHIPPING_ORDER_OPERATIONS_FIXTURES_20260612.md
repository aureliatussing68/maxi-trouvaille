# Maxi Trouvailles - Test fixtures operations commandes dropshipping

Date locale: 2026-06-12 09:54 Europe/Paris

## Resultat

- Statut: OK
- Scenarios operations: 8
- Lignes exportees redigees: 9
- Fuites sensibles detectees: 0

## Scenarios

| Statut | Scenario | File obtenue | Action fournisseur autorisee |
|---|---|---|---|
| OK | wait_payment_blocks_supplier | WAIT_PAYMENT | false |
| OK | paid_stock_failed_blocks_supplier | STOCK_EXCEPTION | false |
| OK | paid_stock_skipped_blocks_supplier | STOCK_EXCEPTION | false |
| OK | paid_stock_pending_blocks_supplier | STOCK_EXCEPTION | false |
| OK | paid_stock_done_ready_supplier_prep | READY_SUPPLIER_PREP | true |
| OK | supplier_order_waits_tracking | WAIT_TRACKING | true |
| OK | shipped_ready_follow_up | READY_FOLLOW_UP | true |
| OK | delivered_done | DONE | true |

## Export redige controle

| Priorite | File | Commande | Stock webhook | Action fournisseur |
|---:|---|---|---|---|
| 1 | STOCK_EXCEPTION | MT-FIX-STOCK-FAILED | failed | false |
| 2 | STOCK_EXCEPTION | MT-FIX-STOCK-SKIPPED | skipped | false |
| 3 | STOCK_EXCEPTION | MT-FIX-STOCK-PENDING | pending-payment | false |
| 10 | READY_SUPPLIER_PREP | MT-FIX-READY | done | true |
| 10 | READY_SUPPLIER_PREP | MT-FIX-PROOF-GAPS | done | true |
| 20 | WAIT_TRACKING | MT-FIX-WAIT-TRACKING | done | true |
| 25 | READY_FOLLOW_UP | MT-FIX-FOLLOW-UP | done | true |
| 40 | WAIT_PAYMENT | MT-FIX-WAIT-PAYMENT | pending-payment | false |
| 90 | DONE | MT-FIX-DONE | done | true |

## Preuves produit

- Gaps attendus sur fixture incomplete: OK
- Gaps obtenus: lien fournisseur, SKU, prix fournisseur, stock fournisseur, delai

## Garde-fous

- Fixtures locales en memoire uniquement.
- Aucune commande reelle lue ou modifiee.
- Aucun paiement.
- Aucune commande fournisseur.
- Aucune publication.
- Aucun lien fournisseur, email, telephone ou adresse client exporte.

