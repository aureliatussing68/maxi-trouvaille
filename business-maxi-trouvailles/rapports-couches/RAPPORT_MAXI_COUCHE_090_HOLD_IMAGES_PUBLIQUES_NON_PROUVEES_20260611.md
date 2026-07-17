# Rapport couche 090 - HOLD images publiques non prouvees

Date: 2026-06-11
Statut: OK_PUBLIC_IMAGES_HELD_RISKS_REMOVED
Decision: correction locale appliquee sur les fiches visibles client avec image non prouvee exacte.

## Objectif

Corriger le probleme visible sur mobile: des fiches publiques pouvaient afficher des images generees, placeholders ou generiques qui ne prouvaient pas exactement l'article vendu.

## Organisation chantier

- Automatisation principale `maxi-trouvailles-couche-par-couche` reactivee en cadence 5 minutes.
- Une seule heartbeat peut etre attachee a ce fil, donc les 3 branches sont pilotees dans le meme chef de chantier.
- Branches Git locales creees:
  - `codex/maxi-images-exactes`
  - `codex/maxi-catalogue-rentable`
  - `codex/maxi-confiance-checkout-mobile`

## Sauvegardes

- `backups/couche-090-hold-images-publiques-non-prouvees-20260611_0435`
- `backups/auto-public-image-hold-20260611-1781148860534/quick-products.json.bak`

## Fichiers modifies

- `data/quick-products.json`
- `scripts/automation/hold_public_products_with_unverified_images.mjs`
- `package.json`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`

## Artefacts generes

- `business-maxi-trouvailles/tableaux-action/public-image-hold-20260611/PUBLIC_IMAGE_HOLD_AUDIT_20260611_DRY_RUN.json`
- `business-maxi-trouvailles/tableaux-action/public-image-hold-20260611/PUBLIC_IMAGE_HOLD_AUDIT_20260611_DRY_RUN.md`
- `business-maxi-trouvailles/tableaux-action/public-image-hold-20260611/PUBLIC_IMAGE_HOLD_AUDIT_20260611.json`
- `business-maxi-trouvailles/tableaux-action/public-image-hold-20260611/PUBLIC_IMAGE_HOLD_AUDIT_20260611.md`

## Resultat

- 16 fiches publiques a risque sont repassees en `draft`/HOLD local.
- 8 produits restent publics et vendables.
- 0 image `/uploads/generated-products/` visible dans `/boutique` apres controle navigateur.
- Les fiches HOLD ont maintenant `imageValidation.status = hold_public_image_not_exact`.

## Fiches retirees du public

- Double prise murale avec 4 ports USB
- Pave tactile MacBook - piece a verifier
- Ventilateur tour de cou rechargeable USB
- Compteur energie WiFi KETOTEK 63A
- Filtre de douche chrome universel
- Cassette velo SunRace - compatibilite a verifier
- Systeme d'alerte SOS WiFi avec 2 boutons
- Kit habillage console centrale effet carbone
- Regulateur d'alternateur ARE4011 12V
- Compteur GPS 85 mm 0-125 km/h
- Carburateur type PWK avec durite et gicleurs
- Poche de froid epaule Revix reusable
- Accoudoir central voiture avec rangements USB
- Supports reglables pour coffre voiture - paire
- Carburateur scooter 4T 50cc Euro 4 - a verifier
- Buste mannequin vitrine - a verifier

## Commandes ajoutees

- `npm run catalog:hold-public-unverified-images`
- `npm run catalog:apply-public-unverified-image-hold`

## Validations executees

- `npm run catalog:hold-public-unverified-images`: OK, 0 nouveau risque public, 16 deja retires.
- `npm run catalog:apply-public-unverified-image-hold`: OK, 16 fiches passees en HOLD.
- `npm run catalog:audit-all-partner-gates`: OK.
- `npm run catalog:audit-checkout-eligibility`: OK, 8 produits achetables attendus.
- `npm run catalog:test-checkout-guards`: OK, 11/11.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- HTTP `/boutique`: 200.
- HTTP `/categories`: 200.
- Browser desktop `/boutique`: anciens produits a image generee absents, aucune URL generated-products, pas de scroll horizontal, 0 erreur console.
- Browser mobile `/boutique`: anciens produits a image generee absents, aucune URL generated-products, pas de scroll horizontal, 0 erreur console.
- Scan anti-secret sur fichiers touches, exports et rapport: OK.

## Limites

- Les 16 fiches ne sont pas supprimees: elles restent disponibles en admin/local pour remplacement par photos exactes.
- Le prochain travail doit remplir les photos exactes produit par produit, puis remettre en public uniquement apres validation.
- En dev local avec mode admin actif, une fiche draft peut rester accessible pour edition; cote client, elle sort des grilles publiques.

## Prochain pas recommande

Creer une page admin "Images publiques HOLD" listant ces 16 fiches avec action photo exacte, remplacer, garder en brouillon ou retirer definitivement apres validation Mouss.
