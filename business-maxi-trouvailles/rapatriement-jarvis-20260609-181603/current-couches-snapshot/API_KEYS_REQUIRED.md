# Cles API a preparer

Ne jamais ecrire les vraies cles dans ce fichier. Utiliser `.env.local`, `.env` Jarvis ou un coffre de secrets.

## IA texte / fiche produit

- `OPENAI_API_KEY` : generation fiche, analyse photo si active.
- `OPENAI_PRODUCT_PHOTO_MODEL` : modele vision pour l'analyse photo.
- `GEMINI_API_KEY` : analyse alternative / multimedia.
- `ANTHROPIC_API_KEY` : redaction longue optionnelle.
- `GROQ_API_KEY` : reponses rapides / vocal optionnel.

## Recherche produit

- `SERPAPI_API_KEY` : recherche web structuree.
- `APIFY_TOKEN` : acteurs de scraping si legalement autorises.
- `ALIEXPRESS_APP_KEY` : API/Affiliate AliExpress si compte valide.
- `ALIEXPRESS_APP_SECRET` : secret API AliExpress.
- `ALIEXPRESS_TRACKING_ID` : tracking affiliate.
- `DSERS_API_KEY` : gestion fournisseur si compte disponible.
- `AUTODS_API_KEY` : automation fournisseur si compte disponible.

## Paiement / site

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` : cle publique Stripe.
- `STRIPE_SECRET_KEY` : cle secrete Stripe. Utiliser test tant que le site n'est pas valide.
- `STRIPE_WEBHOOK_SECRET` : webhook Stripe.
- `DATABASE_URL` : base de donnees production si necessaire.

## Publicites / reseaux

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`
- `SNAPCHAT_CLIENT_ID`
- `SNAPCHAT_CLIENT_SECRET`

## Image / video

- `HEDRA_API_KEY` : avatars/video IA optionnel.
- `CAPCUT_API_KEY` : si API officielle disponible.
- `REMOVE_BG_API_KEY` : suppression fond payante optionnelle.

## Regle

Si une API est payante ou publie du contenu, Jarvis doit demander validation avant usage.
