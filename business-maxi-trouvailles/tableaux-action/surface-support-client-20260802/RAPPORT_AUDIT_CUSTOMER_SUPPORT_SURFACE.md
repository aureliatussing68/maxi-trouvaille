# Audit surface support client

Date: 2026-08-02T12:43:27.647Z
Statut: ECHEC

## Synthese

- Routes support surveillees: 6
- Liens publics attendus: 6
- Alertes: 11

| Regle | Fichier | Ligne |
|---|---|---:|
| missing_maxi_trouvaille | src/components/CustomerSupportQuickLinks.tsx | 1 |
| missing_logistics_partner_wording | src/components/CustomerSupportQuickLinks.tsx | 1 |
| missing_partner_products_wording | src/components/CustomerSupportQuickLinks.tsx | 1 |
| payment_provider_brand | src/components/CustomerSupportQuickLinks.tsx | 31 |
| support_quick_links_not_mounted | src/app/contact/page.tsx | 1 |
| payment_provider_brand | src/app/contact/page.tsx | 42 |
| real_message_link | src/app/contact/page.tsx | 95 |
| payment_provider_brand | src/app/faq/page.tsx | 14 |
| real_message_link | src/app/retours-remboursements/page.tsx | 35 |
| payment_provider_brand | src/app/paiement/page.tsx | 11 |
| payment_provider_brand | src/app/paiement/page.tsx | 37 |

## Garde-fous

- Lecture seule: aucun paiement, aucune commande, aucune publication.
- Les pages client doivent garder le vocabulaire Maxi Trouvaille: paiement, suivi colis, service client, produits partenaires.
- Les routes support doivent rester coherentes sur mobile et renvoyer vers les pages utiles.

