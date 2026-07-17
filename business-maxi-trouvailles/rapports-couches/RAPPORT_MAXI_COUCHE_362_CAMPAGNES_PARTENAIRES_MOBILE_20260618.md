# Rapport Maxi Couche 362 - Campagnes partenaires mobile

Date: 2026-06-18 20:45 Europe/Paris

## Objectif

Renforcer les pages `/nouveautes` et `/promotions` pour qu'elles soient plus
visibles et rassurantes sur téléphone, sans publier de fiche produit douteuse.

## Integrations

- `PartnerCampaignLanding` affiche maintenant les aperçus d'articles en
  validation du rayon concerné.
- Ajout du parcours client sur les campagnes: articles validés, paiement Maxi
  Trouvaille, préparation suivie, suivi colis.
- Ajout des raccourcis support client Maxi Trouvaille sur les campagnes:
  suivi colis, paiement, livraison, retours, FAQ et contact.
- Ajout de l'audit `catalog:audit-partner-campaign-surface` pour verrouiller:
  signaux campagnes, liens utiles, absence de vocabulaire interdit visible et
  garde-fous lecture seule.

## Sauvegarde

- `business-maxi-trouvailles/backups/couche-362-campagnes-partenaires-mobile-20260618`

## Tests et audits

- `npx eslint src/components/PartnerCampaignLanding.tsx scripts/automation/audit_partner_campaign_surface.mjs --no-warn-ignored`
- `npm run catalog:audit-partner-campaign-surface`
- `npm run catalog:audit-public-demo-copy`
- `npm run catalog:audit-mobile-demo-nav`
- `npm run catalog:audit-public-catalog-source-guards`
- `npm run catalog:audit-public-dropshipping-surface`
- `npm run catalog:audit-checkout-eligibility`
- `npm run catalog:audit-seo-hold-visibility`
- `npm run catalog:audit-generated-artifact-leaks`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Verification navigateur mobile

Serveur local temporaire sur `127.0.0.1:3285`, ensuite arrete.

- `/nouveautes` et `/promotions`: aperçus articles en validation présents.
- Bloc support client présent, 6 liens support détectés.
- Navigation mobile: 5 liens détectés, lien actif correct.
- Paiement Maxi Trouvaille et suivi colis visibles.
- Aucun débordement horizontal.
- Aucune erreur console.
- Aucun terme interdit visible dans le texte rendu.

## Garde-fous

- Aucune commande, aucun paiement, aucune publication, aucun deploiement.
- Aucune connexion compte, aucun message reel, aucune API payante.
- Les aperçus restent en validation et ne deviennent pas des fiches achetables.
