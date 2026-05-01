# Deploiement et domaine Maxi Trouvaille

## Hebergeur conseille

Vercel est le choix le plus simple pour ce projet Next.js : build automatique,
preview URL, SSL et domaines personnalises.

Limite actuelle a connaitre : l'admin rapide ecrit dans `data/quick-products.json`
et les photos dans `public/uploads`. Sur Vercel, ce stockage fichier n'est pas
durable en production serverless. Pour garder l'admin en production, prevoir
ensuite une base de donnees et un stockage d'images (Vercel Blob, Supabase,
S3 compatible, etc.).

## Variables production

Copier les valeurs de `.env.production.example` dans les variables du projet
Vercel :

- `NEXT_PUBLIC_SITE_URL=https://maxitrouvaille.fr`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...` plus tard
- `ADMIN_MODE=false`

Stripe reste en test tant que le code refuse les cles `sk_live_`.

## Domaine

Domaine principal souhaite : `maxitrouvaille.fr`.

Redirection preparee dans `next.config.ts` :

- `www.maxitrouvaille.fr/*` vers `https://maxitrouvaille.fr/*`

## DNS OVH vers Vercel

Une fois le projet cree dans Vercel et les domaines ajoutes, configurer chez OVH :

| Nom | Type | Valeur |
| --- | --- | --- |
| `@` | `A` | `76.76.21.21` |
| `www` | `CNAME` | `cname.vercel-dns-0.com` |

Vercel peut demander une valeur differente ou un TXT de verification. Dans ce
cas, suivre la valeur exacte affichee par Vercel pour le projet.

## Email futur

Pour `contact@maxitrouvaille.fr`, garder les MX OVH si l'email est gere chez OVH.
Ne pas supprimer les enregistrements MX/SPF/DKIM existants lors de la connexion
du domaine au site.
