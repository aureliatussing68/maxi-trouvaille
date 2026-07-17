# Rapatriement Jarvis - Maxi Trouvaille

Date: 2026-06-09 18:18 Europe/Paris

Destination:
`C:\Users\sinek\Desktop\maxi-trouvaille\business-maxi-trouvailles\rapatriement-jarvis-20260609-181603`

## Resume

- 441 fichiers presents dans le paquet final.
- 19,81 Mo presents dans le paquet final.
- 4 copies de sessions Codex retirees apres scan anti-fuite cible.
- Les dossiers source Jarvis et `MAXI_TROUVAILLE` sont restes intacts.
- Les fichiers sensibles ou trop lourds ont ete references mais pas copies.
- Le but de ce paquet est de remettre ensemble les couches Maxi, les prompts Jarvis, les sessions Codex et les fichiers de validation produits.

## Sources rapatriees

- `jarvis-tech-enclair/app/logs`: journaux Jarvis business, routes Maxi, validation fournisseur, gates de securite, files de validation.
- `jarvis-tech-enclair/app/parallel_work`: prompts et couches separees, dont `maxi_controlled_commerce_next_layer.md`.
- `ancien-maxi-trouvaille`: anciens scripts TikTok, rapport Maxi, petit set images, backup business source avant Jarvis.
- `sessions-codex`: discussions Codex historiques Maxi non sensibles et automations Maxi retrouvees.
- `current-couches-snapshot`: couches deja presentes dans le vrai projet, produits a valider, docs business, scripts automation.

Les inventaires complets sont dans:

- `inventaires\fichiers_copies.csv`
- `inventaires\fichiers_copies.json`
- `inventaires\fichiers_exclus_ou_references.json`
- `inventaires\resume_rapatriement.json`
- `inventaires\fichiers_presents_final.csv`
- `inventaires\resume_rapatriement_final.json`
- `inventaires\sessions_retires_scan_secret.json`

## Discussions retrouvees

- `Creer boutique Maxi Trouvaille` - session Codex du 2026-05-01, retrouvee mais copie retiree du paquet final apres scan anti-fuite.
- `Auditer le site Maxi Trouvailles` - session Codex du 2026-05-05, retrouvee mais copie retiree du paquet final apres scan anti-fuite.
- `Maxi Trouvailles - video pub toutes les 1h30` - sessions Codex archivees du 2026-05-06.
- `Mettre en place dropshipping` - grosse session Codex du 2026-05-12, retrouvee mais copie retiree du paquet final apres scan anti-fuite.
- Automation Codex `maxi-trouvailles-vid-o-tiktok-toutes-les-2h`.
- Automation Codex `maxi-trouvailles-couche-par-couche`.
- Chantier Jarvis `maxi_controlled_commerce` - couche 958, en mode `HOLD_MANUAL`.

## Couches Maxi deja presentes

Les couches suivantes etaient deja dans le vrai projet et sont recopiees dans `current-couches-snapshot\sauvegardes`:

- `couche_002_partenaires_aliexpress_20260527_115543`
- `couche_003_urls_partenaires_20260527_121926`
- `couche_004_vitrine_categories_20260527_223742`
- `couche_005_ponts_catalogue_20260527_224819`
- `couche_006_selection_produits_20260527_225438`
- `couche_007_admin_selection_20260527_225629`
- `couche_008_nettoyage_public_20260527_230922`
- `couche_009_accueil_produits_20260527_231431`
- `couche_010_boutique_filtres_20260527_232118`
- `couche_011_routes_publiques_20260527_232745`
- `couche_012_flux_validation_partenaires_20260527_233253`
- `couche_013_validation_import_20260528_093747`

La couche produit principale est:

- `current-couches-snapshot\produits-a-valider\selection_couche_006_20260527.md`
- `current-couches-snapshot\produits-a-valider\selection_couche_006_20260527.json`

Elle contient une selection de produits par categorie avec recherches AliExpress Choice Europe, sans commande ni publication.

## Etat fournisseur et images

Jarvis confirme que le systeme doit rester en validation humaine:

- Aucune commande fournisseur.
- Aucun paiement fournisseur.
- Aucun import public automatique.
- Aucune publication sans validation.
- Photos fournisseur exactes a valider avant publication.
- 55 champs de preuves fournisseur restent a remplir.
- 0/6 item pret dans la file de validation fournisseur/import.

Champs de preuve a remplir par ligne fournisseur:

- `url_fournisseur_reel`
- `nom_vendeur`
- `prix_produit`
- `prix_livraison`
- `delai_livraison_europe`
- `note_vendeur`
- `note_produit`
- `nombre_avis`
- `preuve_conformite`
- `preuve_images_utilisables`
- `decision_mouss_avant_import`

Workflow d'audit images recopie:

- `current-couches-snapshot\docs\WORKFLOW_AUDIT_IMAGES_PARTENAIRES_20260605.md`

Commandes utiles:

```powershell
npm run catalog:audit-partners
npm run catalog:partner-summary
npm run catalog:audit-images
npm run catalog:audit-partner-gates
npm run typecheck
npm run lint
```

## Dossiers de travail separes proposes

- Site et affichage client: `src`, `public`, categories, fiches produit, responsive.
- Produits a valider: `business-maxi-trouvailles\produits-a-valider`.
- Fournisseurs et photos: preuves fournisseur, liens reels, images exactes, droits visuels.
- Admin dropshipping: admin commandes, statuts, import manuel, validation Mouss.
- Marketing/TikTok: anciens scripts dans `ancien-maxi-trouvaille\scripts` et scripts sandbox actuels dans `current-couches-snapshot\scripts\automation`.
- Jarvis orchestration: logs, prompts et chantiers dans `jarvis-tech-enclair`.

## Fichiers volontairement non copies

- Backup complet `maxi-trouvaille_full_before_jarvis_20260521_095712.zip`, environ 1 Go.
- Backups `.env.bak`, risque de secrets/API.
- `scripts\stripe code\code confiden.txt`, fichier confidentiel.
- `compte TikTok\infos_compte_tiktok.txt`, risque identifiants.
- `assets\Tri_Photos_Telephone`, photos/videos personnelles et lourdes.
- Archive bureau brute `archives\bureau_avant_tri_2026-05-05`, non specifique Maxi.
- Copies de sessions Codex contenant des motifs de secrets (`sk_test`, tokens, cles privees ou cles AWS detectees par motif). Les originaux restent dans `.codex`, mais le paquet projet ne les centralise pas.

## Verification securite

- Scan anti-fuite cible execute apres nettoyage.
- Resultat final: aucun motif sensible evident trouve dans le paquet final.

## Reprise conseillee

1. Partir de `current-couches-snapshot\produits-a-valider\selection_couche_006_20260527.md`.
2. Choisir 5 produits maximum pour une premiere vague.
3. Remplir les preuves fournisseur reelles pour chaque produit.
4. Remplacer les images generiques par les images fournisseur exactes et utilisables.
5. Lancer les audits images/gates.
6. Importer seulement en brouillon.
7. Publier uniquement apres validation humaine explicite.
