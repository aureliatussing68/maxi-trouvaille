# Audit depots WebP top 3 integration

Date locale: 2026-06-12 12:08 Europe/Paris

## Synthese

- Statut: HOLD_TOP3_WEBP_FILES_MISSING
- Produits controles: 3
- WebP attendus: 9
- WebP valides: 0
- WebP manquants: 9
- WebP invalides: 0
- Echecs structurels: 0
- Alertes sensibles: 0

## Fichiers attendus

| Statut | Produit | Role | WebP attendu | Octets | Blocages |
|---|---|---|---|---:|---|
| MISSING_HOLD | Housse protection canape animal | main | housse-protection-canape-animal-partenaire-hold-main.webp | 0 | expected_webp_missing |
| MISSING_HOLD | Housse protection canape animal | detail | housse-protection-canape-animal-partenaire-hold-detail-1.webp | 0 | expected_webp_missing |
| MISSING_HOLD | Housse protection canape animal | variant | housse-protection-canape-animal-partenaire-hold-variant.webp | 0 | expected_webp_missing |
| MISSING_HOLD | Cache multiprise boite rangement cables | main | cache-multiprise-boite-rangement-cables-partenaire-hold-main.webp | 0 | expected_webp_missing |
| MISSING_HOLD | Cache multiprise boite rangement cables | detail | cache-multiprise-boite-rangement-cables-partenaire-hold-detail-1.webp | 0 | expected_webp_missing |
| MISSING_HOLD | Cache multiprise boite rangement cables | variant | cache-multiprise-boite-rangement-cables-partenaire-hold-variant.webp | 0 | expected_webp_missing |
| MISSING_HOLD | Trousse toilette suspendue voyage | main | trousse-toilette-suspendue-voyage-partenaire-hold-main.webp | 0 | expected_webp_missing |
| MISSING_HOLD | Trousse toilette suspendue voyage | detail | trousse-toilette-suspendue-voyage-partenaire-hold-detail-1.webp | 0 | expected_webp_missing |
| MISSING_HOLD | Trousse toilette suspendue voyage | variant | trousse-toilette-suspendue-voyage-partenaire-hold-variant.webp | 0 | expected_webp_missing |

## Echecs structurels

| Portee | Code | Message | Detail |
|---|---|---|---|
| OK | Aucun echec structurel | - | - |

## Scan sensible

| Type | Fichier | Ligne | Extrait |
|---|---|---:|---|
| OK | Aucun marqueur sensible detecte | - | - |

## Garde-fous

- Lecture seule cote catalogue.
- Aucun telechargement image.
- Aucune copie dans `public/uploads`.
- Aucun fournisseur ou marketplace expose client.
- HOLD maintenu tant que les WebP exacts, droits image et validation Mouss ne sont pas prouves.

