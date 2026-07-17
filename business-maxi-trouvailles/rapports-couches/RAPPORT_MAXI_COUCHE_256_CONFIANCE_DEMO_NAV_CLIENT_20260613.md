# Rapport couche 256 - Confiance demo et navigation client

Date locale: 2026-06-13 12:34 Europe/Paris

## Objectif

Renforcer les pages visibles pendant la démonstration téléphone: accueil, conditions produits partenaires, footer et pages programme partenaires en pause.

## Changements intégrés

- Accueil: ajout d'un bloc "Expérience client" avec rayons lisibles, paiement Maxi Trouvaille, suivi colis et service client.
- Accueil: copie hero et bloc sélection rendus plus client, moins techniques.
- Conditions produits partenaires: retrait de la mention Stripe côté client, remplacée par prestataire de paiement sécurisé.
- Conditions produits partenaires: ajout d'un bloc rassurance et raccourcis suivi/contact/produits partenaires.
- Footer: libellé "CGV provisoires" remplacé par "Conditions générales".
- Pages `/vendre` et `/deposer-annonce`: programme partenaires mis en pause, `noindex`, CTA redirigé vers les produits partenaires au lieu d'inciter à déposer une annonce.

## Vérifications

- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit partenaire visible, 0 achetable, 91 brouillons bloqués.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK.
- Vérification navigateur mobile 390px OK sur `/`, `/conditions-produits-partenaires`, `/vendre`, `/deposer-annonce`: pas d'overflow horizontal, pas d'erreur console, pas de vocabulaire interne ou appel dépôt annonce.

## Garde-fous

- Aucun paiement, achat, commande fournisseur, message réel, connexion compte, publication production ou déploiement.
- Aucune fiche produit n'a été publiée.
- Serveur local de vérification arrêté après contrôle.
