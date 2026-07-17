# Audit parcours public mobile

Date locale: 2026-06-19 04:24 Europe/Paris

## Synthese

- Statut: OK
- Fichiers surveilles: 13
- Signaux detectes: 80
- Liens de parcours detectes: 8
- Hrefs publics inspectes: 45
- Alertes: 0

## Signaux publics

| Fichier | Ligne | Signal |
|---|---:|---|
| src/app/page.tsx | 44 | Maxi Trouvaille |
| src/app/page.tsx | 111 | /boutique |
| src/app/page.tsx | 118 | /produits-partenaires |
| src/app/page.tsx | 67 | /suivi-colis |
| src/app/page.tsx | 58 | Paiement Maxi Trouvaille |
| src/app/page.tsx | 15 | MobilePresentationPathPanel |
| src/app/page.tsx | 13 | CustomerSupportQuickLinks |
| src/app/boutique/page.tsx | 57 | Boutique partenaires |
| src/app/boutique/page.tsx | 5 | MobilePresentationPathPanel |
| src/app/boutique/page.tsx | 10 | PartnerDemoPathPanel |
| src/app/boutique/page.tsx | 13 | PartnerMobileShowcasePanel |
| src/app/boutique/page.tsx | 15 | StorefrontReadinessPanel |
| src/app/boutique/page.tsx | 14 | ShopProductExplorer |
| src/app/produits-partenaires/page.tsx | 114 | Boutique partenaires Maxi Trouvaille |
| src/app/produits-partenaires/page.tsx | 136 | Paiement sécurisé |
| src/app/produits-partenaires/page.tsx | 50 | suivi colis |
| src/app/produits-partenaires/page.tsx | 115 | partenaire logistique |
| src/app/produits-partenaires/page.tsx | 18 | CustomerJourneyPanel |
| src/app/produits-partenaires/page.tsx | 19 | CustomerSupportQuickLinks |
| src/app/produits-partenaires/page.tsx | 285 | /paiement |
| src/app/produits-partenaires/page.tsx | 292 | /suivi-colis |
| src/app/produits-partenaires/page.tsx | 299 | /contact |
| src/app/panier/page.tsx | 58 | Panier sous garde |
| src/app/panier/page.tsx | 60 | Aucun article non prouvé |
| src/app/panier/page.tsx | 72 | Achat verrouillé |
| src/app/panier/page.tsx | 4 | CustomerJourneyPanel |
| src/app/panier/page.tsx | 5 | CustomerSupportQuickLinks |
| src/app/panier/page.tsx | 3 | CartView |
| src/app/paiement/page.tsx | 13 | Paiement Maxi Trouvaille |
| src/app/paiement/page.tsx | 58 | 0 produit achetable sans preuve |
| src/app/paiement/page.tsx | 15 | index: false |
| src/app/paiement/page.tsx | 4 | CustomerJourneyPanel |
| src/app/paiement/page.tsx | 5 | CustomerSupportQuickLinks |
| src/app/paiement/page.tsx | 3 | CheckoutView |
| src/app/suivi-colis/page.tsx | 34 | Suivi colis |
| src/app/suivi-colis/page.tsx | 6 | ServiceReadinessPanel |
| src/app/suivi-colis/page.tsx | 3 | CustomerJourneyPanel |
| src/app/suivi-colis/page.tsx | 4 | CustomerSupportQuickLinks |
| src/app/suivi-colis/page.tsx | 7 | TrackingLookupForm |
| src/app/contact/page.tsx | 20 | Service client |
| src/app/contact/page.tsx | 64 | Maxi Trouvaille reste le point de contact |
| src/app/contact/page.tsx | 16 | ServiceReadinessPanel |
| src/app/contact/page.tsx | 14 | CustomerJourneyPanel |
| src/app/contact/page.tsx | 15 | CustomerSupportQuickLinks |
| src/app/contact/page.tsx | 38 | /suivi-colis |
| src/app/contact/page.tsx | 45 | /paiement |
| src/app/contact/page.tsx | 52 | /produits-partenaires |
| src/components/CartView.tsx | 128 | Panier prêt, paiement contrôlé |
| src/components/CartView.tsx | 132 | paiement Maxi Trouvaille |
| src/components/CartView.tsx | 136 | /produits-partenaires |
| src/components/CartView.tsx | 143 | /suivi-colis |
| src/components/CartView.tsx | 97 | /api/checkout |
| src/components/CartView.tsx | 24 | isClientProductPurchasable |
| src/components/CheckoutView.tsx | 118 | Paiement Maxi Trouvaille prêt |
| src/components/CheckoutView.tsx | 120 | Le paiement s&apos;ouvre seulement |
| src/components/CheckoutView.tsx | 126 | /produits-partenaires |
| src/components/CheckoutView.tsx | 133 | /suivi-colis |
| src/components/CheckoutView.tsx | 88 | /api/checkout |
| src/components/CheckoutView.tsx | 17 | isClientProductPurchasable |
| src/components/CustomerJourneyPanel.tsx | 49 | Parcours client |
| src/components/CustomerJourneyPanel.tsx | 27 | Paiement Maxi Trouvaille |
| src/components/CustomerJourneyPanel.tsx | 37 | Suivi colis |
| src/components/CustomerJourneyPanel.tsx | 61 | /boutique |
| src/components/CustomerJourneyPanel.tsx | 68 | /contact |
| src/components/CustomerSupportQuickLinks.tsx | 73 | Support client Maxi Trouvaille |
| src/components/CustomerSupportQuickLinks.tsx | 22 | /suivi-colis |
| src/components/CustomerSupportQuickLinks.tsx | 29 | /paiement |
| src/components/CustomerSupportQuickLinks.tsx | 36 | /livraison |
| src/components/CustomerSupportQuickLinks.tsx | 43 | /retours-remboursements |
| src/components/CustomerSupportQuickLinks.tsx | 50 | /faq |
| src/components/CustomerSupportQuickLinks.tsx | 57 | /contact |
| src/components/MobileDemoNav.tsx | 16 | /boutique |
| src/components/MobileDemoNav.tsx | 22 | /produits-partenaires |
| src/components/MobileDemoNav.tsx | 28 | /nouveautes |
| src/components/MobileDemoNav.tsx | 34 | /promotions |
| src/components/MobileDemoNav.tsx | 40 | /suivi-colis |
| src/components/MobileDemoNav.tsx | 63 | Navigation rapide mobile |
| src/components/TrackingLookupForm.tsx | 30 | Suivre un colis |
| src/components/TrackingLookupForm.tsx | 9 | Entrez le numéro transmis par Maxi Trouvaille |
| src/components/TrackingLookupForm.tsx | 19 | service client Maxi Trouvaille |

## Chemin mobile

| Etape | Fichier | Ligne | Lien |
|---|---|---:|---|
| Accueil vers boutique | src/app/page.tsx | 111 | /boutique |
| Accueil vers produits partenaires | src/app/page.tsx | 118 | /produits-partenaires |
| Partenaires vers paiement garde | src/app/produits-partenaires/page.tsx | 285 | /paiement |
| Partenaires vers suivi colis | src/app/produits-partenaires/page.tsx | 292 | /suivi-colis |
| Partenaires vers service client | src/app/produits-partenaires/page.tsx | 299 | /contact |
| Panier vide vers rayons partenaires | src/components/CartView.tsx | 136 | /produits-partenaires |
| Paiement vide vers rayons partenaires | src/components/CheckoutView.tsx | 126 | /produits-partenaires |
| Support vers contact | src/components/CustomerSupportQuickLinks.tsx | 57 | /contact |

## Alertes

| Regle | Fichier | Ligne | Detail |
|---|---|---:|---|
| OK | - | - | Aucun ecart detecte |

## Garde-fous

- Audit lecture seule cote catalogue.
- Aucun paiement, aucune commande, aucun message, aucune publication.
- Aucun lien admin, API, route legacy sensible ou URL externe dans le parcours public mobile.
- Aucune fuite AliExpress, Temu, supplier, seller, marketplace ou prix/lien fournisseur.

