# Queue livraison rapide - Top 10 produits a verifier

Date: 2026-06-09 18:42 Europe/Paris

Objectif: concentrer les prochaines couches sur les produits qui ont le plus de potentiel, mais uniquement en brouillon tant que livraison rapide, vendeur, prix, variante et droits images ne sont pas prouves.

Statut global:

- Produits partenaires audites: 33
- Produits en brouillon: 33
- Produits prets publication: 0
- Images catalogue partenaires: OK, 0 anomalie detectee par script
- Blocage principal: delai livraison France/Europe non prouve sur 33/33

## Regles de validation

Un produit ne passe pas `ready_review` tant que ces preuves ne sont pas renseignees:

- vendeur fiable: nom vendeur, note/avis, anciennete ou signal public exploitable;
- livraison rapide France/Europe: idealement 3 a 7 jours, transporteur ou option visible;
- prix fournisseur actuel: produit + variante + devise + frais de livraison;
- correspondance images: image exacte du produit et de la variante vendue;
- droits/usage images: source exploitable ou remplacement par visuels propres;
- validation Mouss: decision explicite avant publication/import sensible.

## Top 10 a traiter

| Priorite | Produit | Categorie | Marge | Stock | SKU/Candidat | Pourquoi lui | A prouver |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Cable USB-C 240W renforce best-seller | high-tech | 40% | 80 | AE-1005007123829293-USB-C-240W | Produit simple, fort potentiel tech, signal FindNiche Europe eleve | vendeur, livraison 3-7j, prix variante, droits images |
| 2 | Organisateur cables 1/5 m bureau best-seller | accessoires | 40% | 100 | AE-1005006994762009-CABLE-ORGANIZER | Petit prix, utile, peu risque, bon produit panier moyen/add-on | vendeur, livraison 3-7j, prix longueur exacte, droits images |
| 3 | Nano tape double-face salle de bain cuisine | maison | 41% | 100 | AE-1005005244419690-NANO-TAPE | Produit maison recurrent, faible risque, bon volume potentiel | vendeur, livraison 3-7j, dimensions, prix, droits images |
| 4 | Ruban double-face puissant maison promo | maison | 41% | 100 | AE-1005006926453576-MONSTER-TAPE | Variante proche nano tape, bon test A/B mais attention doublon | vendeur, livraison 3-7j, variante exacte, prix, droits images |
| 5 | Sac banane sport etanche randonnee | accessoires | 41% | 80 | AE-1005007341990710-SPORT-WAIST-BAG | Produit sport/voyage visuel, marge correcte, peu technique | vendeur, livraison 3-7j, couleur/format, prix, droits images |
| 6 | Serviette microfibre auto detailing promo | auto-moto | 41% | 100 | AE-1005006982838233-CAR-MICROFIBER | Auto utile, faible risque technique, bon add-on | vendeur, livraison 3-7j, taille/lot exact, prix, droits images |
| 7 | Spray huile cuisine reutilisable best-seller | cuisine | 40% | 80 | AE-1005008253500940-OIL-SPRAYER | Produit cuisine viral, mais contact alimentaire a verifier | vendeur, livraison 3-7j, matiere/contact alimentaire, prix, droits images |
| 8 | Support telephone magnetique voiture promo | auto-moto | 41% | 80 | AE-1005004558050711-MAGNETIC-CAR-MOUNT | Produit auto/telephone populaire, mais usage auto a cadrer | vendeur, livraison 3-7j, compatibilite, fixation, prix, droits images |
| 9 | Trousse maquillage voyage transparente best-seller | mode | 40% | 90 | AE-1005006801982174-MAKEUP-TRAVEL-POUCH | Produit voyage/mode facile a comprendre, bon visuel | vendeur, livraison 3-7j, dimensions/couleur, prix, droits images |
| 10 | Lampe velo USB rechargeable affichage batterie | high-tech | 41% | 80 | AE-1005007344943912-BIKE-LIGHT | Potentiel sport/high-tech, mais batterie/eclairage a verifier | vendeur, livraison 3-7j, autonomie/batterie, prix, droits images |

## Actions prochaines couches

1. Traiter les produits 1 a 5 en premier.
2. Pour chaque produit, collecter les preuves publiques sans connexion compte.
3. Si livraison rapide non prouvee, garder HOLD et chercher fournisseur alternatif Europe/France.
4. Si image exacte douteuse, garder HOLD et remplacer par visuels propres avant publication.
5. Relancer:

```powershell
npm run catalog:proof-checklist
npm run catalog:verification-queue
npm run catalog:audit-partners
```

## Decision de couche

Decision: HOLD_GLOBAL

Raison: la base catalogue est saine en brouillon, mais aucune fiche ne peut etre publiee tant que la livraison rapide et les preuves fournisseur ne sont pas valides.

