# Audit artefacts generes - fuites sensibles

Date locale: 2026-06-18 22:01 Europe/Paris

## Synthese

- Statut: OK
- Dossiers scannes: 7
- Fichiers scannes: 14
- Alertes: 0

| Type | Fichier | Ligne | Extrait |
|---|---|---:|---|
| OK | Aucun marqueur sensible detecte | - | - |

## Notes

- Les noms de champs vides comme `exactProductUrl` ou `supplierUrlMissingHold` ne sont pas des fuites.
- Les liens internes `/admin/...` et les chemins locaux Windows sont autorises.
- Les sorties de cet audit sont exclues pour eviter les boucles d'echantillons d'alertes precedentes.
- Les URLs externes reelles, marketplaces interdites et valeurs de cle sont bloquees.

## Garde-fous

- Lecture seule.
- Aucune modification catalogue.
- Aucune publication.
- Aucun paiement.
- Aucune commande partenaire.

