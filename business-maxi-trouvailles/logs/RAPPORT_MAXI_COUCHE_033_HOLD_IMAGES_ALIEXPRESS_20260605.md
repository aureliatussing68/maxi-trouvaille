# Rapport Maxi Trouvailles - Couche 033 - HOLD images AliExpress

## Objectif

Eviter que le site public affiche des produits AliExpress avec des images de categorie generiques qui ne representent pas exactement le produit vendu.

## Constat

10 fiches partenaires AliExpress publiees utilisaient une image issue de `public/uploads/category-images/` au lieu d'une photo produit fournisseur exacte.

Exemples visibles :

- Support telephone voiture 360 : image de categorie Auto / moto.
- Lot 2 lampes LED detection mouvement USB : image de categorie Maison.

## Fichier modifie

- `data/quick-products.json`

## Sauvegarde creee

- `backups/couche033_images_aliexpress_hold_20260605_033425/quick-products.json`

## Changements faits

- Passage en `draft` des 10 fiches AliExpress avec image de categorie generique.
- Ajout d'un champ `imageValidation.status = hold` sur ces fiches.
- Ajout d'une consigne interne : selectionner une annonce fournisseur precise, verifier la correspondance photo/produit, remplacer `image` et `images`, puis remettre en `published`.

## Produits mis en HOLD photo

- Support telephone voiture 360
- Lot 2 lampes LED detection mouvement USB
- Brosse anti-poils animaux reutilisable
- Support ordinateur portable pliant aluminium
- Sacs rangement sous vide voyage
- Mini humidificateur USB bureau & maison
- Pochette rangement cables voyage
- Gourde pliable silicone voyage
- Tapis silicone anti-eclaboussures evier
- Filet rangement coffre voiture

## Garde-fous respectes

- Aucune commande fournisseur.
- Aucun paiement.
- Aucune publication reelle.
- Aucun envoi mail.
- Aucune connexion compte.
- Aucun secret affiche.
- Aucun fichier Jarvis ou Roblox touche.

## Prochaine couche conseillee

Couche 034 : reprendre un seul produit en HOLD, choisir une annonce fournisseur precise, verifier que les photos correspondent au produit, importer/remplacer les images, enrichir la fiche produit, puis remettre en `published` uniquement si la correspondance est claire.
