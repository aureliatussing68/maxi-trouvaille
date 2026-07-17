# Workflow audit images partenaires

Date: 2026-06-05

Ce workflow sert a verifier les fiches partenaires apres une couche de correction images. Il reste manuel et local : il ne publie rien, ne commande rien, ne contacte aucun fournisseur et ne modifie pas le catalogue.

## Quand l'utiliser

- Apres modification de `data/quick-products.json`.
- Apres import ou reprise d'une fiche partenaire.
- Avant une revue manuelle de publication.

## Controle rapide

```powershell
npm run catalog:audit-images
```

Le controle doit retourner:

- `ok: true`
- `failureCount: 0`

Si le controle echoue, garder les fiches en `draft` et corriger uniquement les points listes par le script.

## Controle complet apres une couche

```powershell
npm run catalog:audit-images
npm run typecheck
npm run lint
```

Un `npm run build` est recommande apres un paquet de plusieurs couches catalogue ou apres toute modification de code visible.

## Garde-fous

- Sauvegarder tout fichier existant avant modification.
- Ne jamais remplacer une image generique par une image non verifiee.
- Garder `status: draft` tant que fournisseur, prix, delai, variante et droit d'usage des visuels ne sont pas valides manuellement.
- Ne jamais afficher ni copier de secrets dans un rapport.
- Ne jamais publier, commander, payer, connecter un compte ou supprimer sans validation manuelle explicite.

## Rapport attendu

Chaque couche doit indiquer:

- le produit ou fichier touche;
- la sauvegarde creee;
- les tests executes;
- le resultat du scan anti-fuite cible;
- les validations restees en HOLD.
