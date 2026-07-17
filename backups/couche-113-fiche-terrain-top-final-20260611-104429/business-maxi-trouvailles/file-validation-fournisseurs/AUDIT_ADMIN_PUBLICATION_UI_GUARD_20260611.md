# Maxi Trouvailles - Audit UI garde publication admin

Date locale: 2026-06-11 10:42 Europe/Paris
Statut: OK_ADMIN_PUBLICATION_UI_GUARD_ACTIVE

## Synthese

- Checks UI: 9
- Echecs UI: 0
- Publication automatique: aucune.
- Paiement/commande fournisseur: aucun.

## Checks

| Controle | Statut | Blocage si KO |
|---|---|---|
| client_guard_panel_present | OK | Le formulaire admin doit afficher une garde publication dropshipping. |
| client_guard_computes_blockers | OK | Le formulaire doit calculer les blocages avant publication. |
| client_guard_disables_submit | OK | Le bouton de sauvegarde doit bloquer une tentative de publication incomplete. |
| server_blockers_are_displayed | OK | Les blocages HTTP 400 de la route admin doivent etre visibles dans le formulaire. |
| required_fields_match_server_guard | OK | La checklist UI doit rester alignee avec les preuves serveur obligatoires. |
| proof_shortcuts_present | OK | La garde UI doit proposer des raccourcis vers preuves, pilotage et photos. |
| proof_page_slug_anchor_present | OK | La page preuves partenaires doit exposer une ancre par slug produit, y compris hors formulaires rapides. |
| proof_page_search_filter_present | OK | La page preuves partenaires doit proposer une recherche par URL, filtrer les listes HOLD et exporter le CSV filtre. |
| proof_page_top_verification_board_present | OK | La page preuves partenaires doit afficher un classement des produits HOLD a verifier en priorite, l'exporter en CSV court et fournir une mini fiche terrain. |

## Sources

- Formulaire: src\components\ProductEditForm.tsx
- Page preuves: src\app\admin\preuves-partenaires\page.tsx
- Route admin: src\app\api\admin\products\[slug]\route.ts

