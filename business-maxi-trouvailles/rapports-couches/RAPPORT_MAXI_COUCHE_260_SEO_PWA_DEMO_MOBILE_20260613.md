# Rapport couche 260 - SEO PWA demo mobile

Date locale: 2026-06-13 13:08 Europe/Paris

## Objectif

Renforcer les signaux visibles par Google, le partage mobile et l'installation PWA pour que la demo reste centree sur Maxi Trouvaille, produits partenaires, paiement Maxi Trouvaille, suivi colis et service client.

## Changements integres

- Metadata globale: description, OpenGraph et Twitter card recentres sur produits partenaires, paiement Maxi Trouvaille, suivi colis et service client.
- Image OpenGraph globale: `/uploads/category-images/produits-partenaires.webp`.
- Manifest PWA: description nettoyee, `short_name` complet et raccourcis vers `/produits-partenaires` et `/suivi-colis`.
- Robots: ajout de `/avis/laisser` et `/offline` aux routes non indexables.
- FAQ: retrait d'une formulation trop interne et ajout d'une meta description claire.
- Categories: remplacement de "avant ouverture" par "avant mise en avant".
- Page avis invalide: noindex/nofollow et message client propre redirigeant vers le service client.
- Page hors ligne: noindex/nofollow et copie client plus propre.

## Verifications

- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit partenaire visible, 0 achetable, 0 warning, 91 brouillons bloques.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK.
- Verification navigateur mobile 390px OK sur `/`, `/faq`, `/categories`, `/avis/laisser`, `/offline`: pas d'overflow horizontal, pas de terme fournisseur/Stripe/HOLD/marge visible, noindex actif sur avis/offline.
- Verification navigateur OK de `/manifest.webmanifest`: description et raccourcis produits partenaires/suivi colis presents.
- Verification navigateur OK de `/robots.txt`: admin/api/panier/paiement/avis/offline/routes legacy interdits, sitemap present.

## Garde-fous

- Aucun paiement, achat, commande fournisseur, message reel, connexion compte, publication production ou deploiement.
- Aucune fiche produit n'a ete publiee.
- Serveur local de verification arrete apres controle.
