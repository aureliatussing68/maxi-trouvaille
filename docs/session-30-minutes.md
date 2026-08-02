# La session de 30 minutes — tout allumer, écran par écran

**Pour :** Mustapha · **Écrit le :** 2026-08-02

Ce guide, c'est ta liste de courses. Tu le suis de haut en bas, une ligne à la fois.
Tu n'as rien à comprendre à la technique. Tu cliques là où c'est écrit, tu copies-colles ce qui est indiqué.

Tout le reste (le code) est déjà prêt et attend ces réglages. Tant que tu ne les fais pas, le site continue de tourner exactement comme aujourd'hui : rien ne casse, rien ne change.

---

## 3 règles d'or pendant toute la session

1. **Si on te demande une carte bancaire, tu t'arrêtes.** Aucune étape de ce guide n'exige de payer quoi que ce soit. Si un écran réclame une carte, c'est que tu es sur la mauvaise offre : reviens en arrière et cherche l'offre gratuite (« Free », « Basic », « Hobby »).
2. **Chez OVH, tu AJOUTES des lignes, tu n'en SUPPRIMES jamais.** Supprimer une ligne DNS peut couper ton adresse email `contact@maxitrouvaille.fr`.
3. **Une clé, ça se copie une seule fois.** Quand un site t'affiche une clé (un long code), il ne te la remontrera jamais. Colle-la tout de suite là où c'est demandé. Et tu ne me l'envoies pas dans le chat : je n'en ai pas besoin.

---

## Avant de commencer

### Ce que tu dois avoir sous la main

- [ ] Ton accès **Vercel** (le site qui héberge la boutique) — email + mot de passe, ou connexion par GitHub
- [ ] Ton accès **Stripe** (là où l'argent arrive) — email + mot de passe + ton téléphone pour le code de sécurité
- [ ] Ton accès **AliExpress** (le fournisseur) — email + mot de passe *(seulement pour l'étape 3)*
- [ ] Ton accès **OVH** (là où est enregistré maxitrouvaille.fr) — email + mot de passe *(seulement pour l'étape 4)*
- [ ] Ton téléphone à côté de toi (plusieurs sites envoient un code par SMS)
- [ ] De quoi noter, ou un fichier texte ouvert, pour coller les clés au fur et à mesure

### Combien de temps ça prend vraiment

| Étape | Durée réelle | Vital ? |
|---|---|---|
| **1. La base de données** | ~10 min | 🔴 **OUI — à faire en premier** |
| **2. Le webhook Stripe** | ~5 min | 🔴 **OUI** |
| **2 bis. Ouvrir ton cockpit** | ~2 min | 🟠 Fortement conseillé |
| **3. DSers (fournisseur)** | ~15 min | 🟡 Peut attendre |
| **4. Les emails clients** | ~5 min de clics **+ attente** (de 5 min à quelques heures pour le DNS) | 🟡 Peut attendre |
| **5. L'IA service client** | ~5 min | ⚪ Totalement optionnel |

**Sois honnête avec toi-même sur le temps :** les étapes **1 + 2 + 2 bis** tiennent en 20 minutes et ce sont les seules urgentes. Les étapes 3, 4 et 5 peuvent être faites un autre jour, une par une. Si tu n'as qu'un quart d'heure aujourd'hui, fais 1 et 2, et arrête-toi là. C'est déjà l'essentiel.

---

## 🔴 Étape 1 — La base de données (≈10 min)

### Pourquoi c'est vital, en une phrase

Aujourd'hui, quand un client paie, sa commande et son adresse sont écrites dans un fichier temporaire du serveur qui peut être effacé à tout moment : **tu pourrais avoir l'argent sur Stripe sans savoir quoi envoyer, ni à qui.**

### Ce qu'on fait

On crée un vrai coffre-fort (une « base de données ») où les commandes et les messages clients restent pour toujours.

1. Va sur **https://vercel.com** et connecte-toi.
2. Clique sur ton projet **maxi-trouvaille**.
3. En haut, clique sur l'onglet **Storage**.
4. Clique sur le bouton **Create Database**.
5. Une liste de choix s'affiche. Choisis **Neon — Serverless Postgres**.
   → *Si tu ne vois pas « Neon », prends celui dont le nom contient le mot **Postgres**. C'est le mot qui compte.*
6. Choisis l'offre **Free** (gratuite).
   → *Si on te réclame une carte bancaire ici : **stop**, tu n'es pas sur la bonne offre. Reviens en arrière.*
7. Pour la région (« Region »), choisis une région en **Europe** — Frankfurt ou Paris si proposé.
8. Laisse le nom proposé par défaut, ou tape `maxi-trouvaille-db`.
9. Clique sur **Create**.
10. Un écran te propose de relier la base au projet : **Connect** (ou « Connect Project ») → coche le projet **maxi-trouvaille** → valide.
    → *Coche bien les 3 environnements si on te le demande : Production, Preview, Development.*

### Vérifier que c'est bien branché

11. Va dans **Settings** → **Environment Variables**.
12. Dans la liste, cherche une ligne qui s'appelle **`DATABASE_URL`** ou **`POSTGRES_URL`**.
    - ✅ **Tu la vois** → parfait, passe au point 13.
    - ❌ **Tu ne la vois pas** → retourne dans **Storage**, ouvre ta base, trouve le bouton qui affiche la **connection string** (une longue adresse qui commence par `postgres://`), copie-la. Puis reviens dans **Settings → Environment Variables**, clique **Add**, nom : `DATABASE_URL`, valeur : ce que tu viens de copier, coche **Production**, et **Save**.

### Redéployer (obligatoire — sinon rien ne change)

13. Va dans l'onglet **Deployments**.
14. Sur la ligne tout en haut (le déploiement le plus récent), clique sur les **trois petits points `...`** à droite.
15. Clique sur **Redeploy**, puis confirme **Redeploy**.
16. Attends que le rond passe au vert (1 à 3 minutes).

✅ **Étape 1 terminée.** Tes futures commandes sont désormais dans un vrai coffre-fort.

> ⚠️ **Une chose à savoir, sans mauvaise surprise :** ce qui était dans l'ancien fichier temporaire n'est **pas** récupéré. La base démarre vide et se remplit à partir de maintenant. Si tu as déjà eu de vraies commandes, elles restent visibles dans ton tableau de bord Stripe — c'est là qu'il faut aller les chercher.

---

## 🔴 Étape 2 — Le webhook Stripe (≈5 min)

### Pourquoi

Le « webhook », c'est le coup de fil que Stripe passe à ton site pour lui dire : « ce client vient de payer pour de vrai ». Sans ce coup de fil, ta commande reste marquée « en attente » alors que l'argent est déjà arrivé.

Le code du site est **déjà prêt** à recevoir ce coup de fil. Il lui manque juste le mot de passe secret.

1. Va sur **https://dashboard.stripe.com** et connecte-toi.
2. 🔴 **Vérifie en haut de l'écran que tu n'es PAS en « Mode test ».** S'il y a un interrupteur « Mode test » / « Test mode » activé, éteins-le. On travaille sur le vrai argent.
3. Dans le menu, va dans **Développeurs** (« Developers ») → **Webhooks**.
   → *Selon la version de Stripe, ça peut s'appeler **Workbench** puis **Webhooks**. C'est le même endroit.*
4. Clique sur **Ajouter un endpoint** (« Add endpoint »).
5. Dans le champ **URL du endpoint**, colle exactement ceci :

   ```
   https://maxitrouvaille.fr/api/stripe/webhook
   ```

6. Clique sur **Sélectionner des événements** (« Select events »).
7. Dans la barre de recherche, tape : `checkout.session.completed`
8. Coche **uniquement** cette ligne : `checkout.session.completed`
9. Valide (« Add events »), puis clique sur **Ajouter un endpoint** / **Create**.
10. Tu arrives sur la page de ton endpoint. Cherche **Secret de signature** (« Signing secret ») et clique sur **Révéler** (« Reveal »).
11. Un code s'affiche, il commence par **`whsec_`**. **Copie-le.**

### Coller le secret dans Vercel

12. Retourne sur **https://vercel.com** → projet **maxi-trouvaille** → **Settings** → **Environment Variables**.
13. Regarde d'abord si une variable **`STRIPE_WEBHOOK_SECRET`** existe déjà dans la liste.
    - Si elle existe → clique sur les trois points `...` à sa droite → **Edit**.
    - Si elle n'existe pas → clique sur **Add**, nom : `STRIPE_WEBHOOK_SECRET`.
14. Dans le champ **Value**, colle le code `whsec_...`.
15. Coche l'environnement **Production**.
16. Clique sur **Save**.

> ### ⚠️ **AVERTISSEMENT — LE PIÈGE QUI NOUS A DÉJÀ COÛTÉ 3 HEURES** ⚠️
>
> **Quand un champ « Value » de Vercel est VIDE, il affiche quand même un exemple de clé en gris clair.**
>
> **On croit voir la clé. Il n'y a RIEN.**
>
> **Regarde bien : le texte gris pâle = champ vide. Le texte noir/foncé = vraie valeur.**
>
> **Ne conclus JAMAIS « c'est bon, je la vois » en regardant l'écran. La seule preuve valable, c'est le test du point 19 ci-dessous.**
>
> *(Et vérifie aussi qu'aucune vieille clé ne traîne dans le champ « Note » / « Comment » : ça nous est déjà arrivé.)*

### Redéployer, puis PROUVER que ça marche

17. Onglet **Deployments** → trois points `...` sur la ligne du haut → **Redeploy** → confirmer.
18. Attends le rond vert (1 à 3 minutes).
19. **Le test qui prouve tout** — retourne sur Stripe, sur la page de ton endpoint :
    - clique sur **Envoyer un événement test** (« Send test event »),
    - choisis `checkout.session.completed`,
    - envoie.
20. Regarde la réponse affichée :
    - ✅ **`200`** → c'est branché, tu as gagné.
    - ❌ **`400` avec le message « Webhook Stripe non configure »** → la clé n'est pas arrivée. Relis l'avertissement ci-dessus, recolle le secret, re-redéploie.

✅ **Étape 2 terminée.** Les paiements réels marqueront maintenant les commandes comme payées, tout seuls.

---

## 🟠 Étape 2 bis — Ouvrir ton cockpit pour voir tes commandes (≈2 min)

Petit détail important que tu dois savoir : **aujourd'hui, ton espace admin est fermé sur le site en ligne.** Si tu vas sur `maxitrouvaille.fr/admin/pilotage`, tu lis « Le mode admin est desactive ». Donc tu ne peux pas voir tes commandes arriver.

Pour l'ouvrir :

1. Vercel → projet **maxi-trouvaille** → **Settings** → **Environment Variables**.
2. Cherche la variable **`ADMIN_MODE`** (elle existe déjà, sa valeur est `false`).
3. Clique sur les trois points `...` → **Edit** → remplace `false` par : `true`
4. Coche **Production** → **Save**.
5. **Deployments** → `...` → **Redeploy**.
6. Va sur **https://maxitrouvaille.fr/admin/pilotage** : tu dois maintenant voir ton tableau de bord.

> ⚠️ **À savoir, en toute franchise :** aujourd'hui ce cockpit n'est protégé par **aucun mot de passe**. Une fois ouvert, n'importe qui qui devine l'adresse `/admin/pilotage` peut y entrer et voir tes commandes.
>
> **Deux choix, c'est toi qui décides :**
> - **Prudent :** tu mets `true`, tu fais tes tests, puis tu remets `false` + Redeploy juste après.
> - **Pratique :** tu laisses `true` en attendant que je te pose une vraie protection par mot de passe. **Dis-le-moi et je m'en occupe — c'est du code, c'est mon travail, pas le tien.**

---

## 🟡 Étape 3 — DSers, la commande chez le fournisseur (≈15 min)

### Lis ça avant de commencer — c'est important

Je dois être honnête avec toi sur ce que DSers fait **et ne fait pas** :

- ❌ **DSers ne peut pas se brancher directement sur ta boutique.** DSers se connecte à Shopify, WooCommerce, Wix, TikTok Shop… Ta boutique est un site sur mesure, elle n'est dans aucune de ces cases. La voie prévue pour ton cas, c'est **l'import des commandes par fichier** (« CSV Upload ») — c'est exactement pour ça que DSers l'a créée : *« quand tu n'as pas de boutique ou que tu vends sur une plateforme que DSers ne prend pas en charge »*.
- ❌ **Même avec DSers, le clic de paiement reste manuel.** Les commandes arrivent dans un onglet « Awaiting payment » (en attente de paiement) et c'est toi qui payes chez AliExpress. Personne ne te vendra une machine qui achète toute seule sans que tu regardes — et heureusement : fournisseur en rupture, prix qui monte, commande frauduleuse, la machine achèterait quand même.
- ✅ **Ce que DSers t'apporte vraiment :** au lieu de retaper l'adresse du client à la main sur AliExpress produit par produit, tu importes tes commandes d'un coup, tu vérifies, tu payes. C'est ça le gain de temps.

**Ce que ça veut dire pour toi :** on reste sur le mode « 1 oui par vente » qu'on avait prévu. C'est le bon mode.

**Le fichier à importer, tu n'as pas à le préparer :** ta fiche de commande contient déjà tout (nom, adresse complète, produit, lien fournisseur, quantité). La mise au format DSers, c'est du code, c'est moi qui m'en occupe.

### Créer le compte

1. Va sur **https://www.dsers.com**
2. Clique sur **Sign up** / **Get started** et crée ton compte avec ton email.
3. Choisis l'offre **Basic** — c'est celle qui est **gratuite**, sans limite de durée.
4. Valide l'email de confirmation.

### Relier AliExpress

5. Dans DSers, cherche dans les réglages **Link to AliExpress** (relier à AliExpress).
6. Clique, connecte-toi avec ton compte AliExpress, autorise DSers.
7. Vérifie que le statut passe à « lié » / « linked ».

### Le moyen de paiement — attention, il n'est PAS chez DSers

8. Le paiement des commandes se fait **chez AliExpress**, pas chez DSers. C'est donc dans ton compte AliExpress que ta carte doit être enregistrée : **AliExpress → My Account → Payment / Cartes**.
9. Vérifie que ton adresse de facturation est complète (une adresse incomplète est la cause n°1 des commandes qui échouent).

### Avant de payer le moindre abonnement — lis ça

10. Repère dans l'interface le bouton **CSV Upload** (import de commandes par fichier).
11. **Essaie-le une fois, avec le modèle vide qu'ils fournissent, pendant que tu es encore sur l'offre gratuite.**
12. **Trois questions à te poser avant de sortir un centime :**
    - Est-ce que l'import de commandes par fichier fonctionne bien avec mon offre gratuite Basic ?
    - Combien coûte exactement l'offre supérieure, **affichée aujourd'hui sur leur page tarifs** ? *(à ma dernière vérification, la première offre payante tournait autour de 20 $ par mois — mais ne me crois pas sur parole, les prix bougent : va lire le chiffre toi-même sur https://www.dsers.com/pricing)*
    - Est-ce que je fais déjà assez de ventes par jour pour que ce temps gagné vaille cet abonnement ?

> 💶 **C'est ta décision et uniquement la tienne.** Moi je ne paye rien, je ne m'abonne à rien, je ne crée aucun compte à ta place. Mon conseil : **reste sur l'offre gratuite tant que tu n'as pas plusieurs commandes par jour.** À une ou deux ventes quotidiennes, tu vas plus vite à la main qu'en payant un abonnement.

✅ **Étape 3 terminée.**

---

## 🟡 Étape 4 — Les emails aux clients (≈5 min de clics + attente)

On utilise **Resend**. Gratuit (3 000 emails par mois, maximum 100 par jour), **sans carte bancaire**, et les emails partiront depuis une vraie adresse `@maxitrouvaille.fr`.

### Créer le compte (2 min)

1. Va sur **https://resend.com**
2. Clique sur **Get Started** / **Sign Up**.
3. Inscris-toi avec Google, ou email + mot de passe.
   → *Aucune carte bancaire ne doit être demandée. Si on t'en réclame une, tu es sur une offre payante : reviens et prends **Free**.*
4. Valide l'email de confirmation.

### Ajouter ton domaine (3 min)

5. Menu de gauche → **Domains** → **Add Domain**.
6. Tape : `maxitrouvaille.fr`
7. Région : choisis l'**Europe (Ireland / eu-west-1)**.
8. Valide. Resend affiche un **tableau de 3 ou 4 lignes** à recopier (une ligne MX, une TXT qui commence par `v=spf1`, une TXT nommée `resend._domainkey`, parfois une DMARC).
9. **Laisse cet onglet ouvert.** Tu vas en avoir besoin tout de suite.

### Recopier ces lignes chez OVH (5 min)

10. Nouvel onglet : **https://www.ovh.com/manager** → connecte-toi.
11. **Web Cloud** → **Noms de domaine** → clique sur **maxitrouvaille.fr**.
12. Onglet **Zone DNS**.
13. Pour **chaque** ligne affichée par Resend : **Ajouter une entrée** → choisis le type (MX ou TXT) → copie-colle **exactement** le nom et la valeur.
    → *Copier-coller uniquement. Ne retape jamais à la main : un caractère de travers et rien ne marche.*

> 🔴 **RÈGLE D'OR : tu AJOUTES, tu ne SUPPRIMES rien.**
> Les lignes de Resend concernent un sous-domaine `send.maxitrouvaille.fr` : ton adresse `contact@maxitrouvaille.fr` continuera de fonctionner normalement.
> **Si OVH te propose de remplacer ou de supprimer quelque chose : tu dis NON et tu m'appelles.**

### Attendre puis vérifier

14. Retourne sur Resend → clique sur **Verify DNS Records**.
15. Attends que tout passe au **vert** (« Verified »).
    → *Encore orange / « Pending » ? Ce n'est pas un problème. Reviens vérifier dans une heure. Le DNS met parfois du temps.*

### Récupérer la clé (2 min)

16. Menu de gauche → **API Keys** → **Create API Key**.
17. Nom : `maxitrouvaille-prod`
18. Permission : **Sending access** (envoi seulement — c'est plus sûr).
19. Domaine : `maxitrouvaille.fr`
20. **Create**. Une clé s'affiche, elle commence par **`re_`**.
    🔴 **Elle n'est affichée qu'UNE SEULE FOIS. Copie-la immédiatement.**

### Coller dans Vercel (3 min)

21. Vercel → projet **maxi-trouvaille** → **Settings** → **Environment Variables**.
22. Ajoute **deux** variables, cochées **Production** :

    | Nom | Valeur |
    |---|---|
    | `RESEND_API_KEY` | la clé `re_...` que tu viens de copier |
    | `EMAIL_FROM` | `Maxi Trouvaille <commandes@maxitrouvaille.fr>` |

23. **Save**, puis **Deployments** → `...` → **Redeploy**.

✅ **Étape 4 terminée.** Les emails partent maintenant tout seuls.

💡 **Astuce : tu peux tester sans attendre le DNS.** Juste après avoir créé ton compte, Resend t'autorise à envoyer depuis `onboarding@resend.dev`, mais uniquement vers **ta propre adresse d'inscription**. Pratique pour vérifier que ça marche pendant que le DNS se propage. *(D'ailleurs, si tu colles `RESEND_API_KEY` sans mettre `EMAIL_FROM`, le site enverra automatiquement depuis cette adresse de test — pratique pour essayer, mais pas joli pour un vrai client : mets `EMAIL_FROM` dès que ton domaine est vérifié.)*

🛑 **Le bouton d'arrêt d'urgence des emails.** Si un jour tu veux couper tous les envois d'un coup **sans supprimer ta clé** : ajoute la variable `MAXI_EMAILS_ENABLED` avec la valeur `false`, puis Redeploy. Plus aucun email ne part. Pour les rallumer : remets `true` (ou supprime la variable) et Redeploy. Tant que tu ne crées pas cette variable, les emails fonctionnent normalement — tu n'as rien à faire aujourd'hui.

---

## ⚪ Étape 5 — L'IA service client (≈5 min, totalement optionnel)

**Elle ne répond jamais toute seule au client.** Elle prépare un brouillon dans ton espace messages, tu le relis, tu corriges si besoin, tu envoies. C'est le même principe que ton « 1 oui par vente ».

Pourquoi ce garde-fou : une IA peut inventer un délai de livraison ou promettre un remboursement. Chez un dropshipper, ça finit en litige.

**Et si tu ne fais pas cette étape ?** Rien de grave : le site te proposera quand même des réponses pré-écrites, gratuites, classées par sujet (livraison, suivi, retour, paiement, produit, stock). Tu peux très bien démarrer comme ça et brancher l'IA dans trois mois.

1. Va sur **https://platform.claude.com** (attention : c'est le compte **développeur**, pas l'abonnement Claude classique à 20 € — ce sont deux choses différentes).
2. **Sign up** avec ton email ou Google.
3. On te demandera de vérifier ton **numéro de téléphone par SMS**. C'est normal, c'est ce qui débloque le crédit offert.
4. Regarde s'il y a un bandeau proposant de réclamer le **crédit gratuit d'environ 5 $**. Clique dessus. Tu peux vérifier ton solde dans **Settings → Billing**.
5. Menu de gauche → **API Keys** → **Create Key**.
6. Nom : `maxitrouvaille-support` → **Create**.
7. Une clé s'affiche, elle commence par **`sk-ant-`**. 🔴 **Copie-la tout de suite, elle ne sera plus jamais affichée.**
8. Vercel → **Settings** → **Environment Variables** → **Add**. Il faut **deux** variables (une clé **et** un interrupteur), toutes les deux cochées **Production** :

   | Nom | Valeur |
   |---|---|
   | `ANTHROPIC_API_KEY` | ta clé `sk-ant-...` |
   | `MAXI_SUPPORT_AI_ENABLED` | `true` |

   → *La clé seule ne suffit pas : sans l'interrupteur `MAXI_SUPPORT_AI_ENABLED` à `true`, l'IA reste éteinte. C'est volontaire — comme ça tu peux coller la clé aujourd'hui et allumer plus tard.*
9. **Save** → **Deployments** → `...` → **Redeploy**.
10. Pour l'éteindre un jour : remets `MAXI_SUPPORT_AI_ENABLED` à `false` → Redeploy. Le site repasse tout seul sur les réponses pré-écrites gratuites.

### Ce que ça coûte vraiment

- Environ **0,35 $ pour 100 messages clients dans le mois** — soit à peu près 30 centimes. Moins cher qu'un café.
- Le crédit gratuit d'environ 5 $ représente à peu près **1 400 messages**, donc **plus d'un an** à ce rythme.
- **Pas d'abonnement.** Tu payes ce que tu consommes, et seulement quand tu recharges toi-même. Si le crédit tombe à zéro, l'IA s'arrête et le site repasse tout seul sur les réponses pré-écrites gratuites. Aucune mauvaise surprise possible sur ta carte.
- 🔒 **Le jour où tu rechargeras :** va dans **Settings → Limits** et mets une **limite de dépense mensuelle à 5 $**. Comme ça, même si quelque chose déraille, c'est plafonné.

---

## ✅ Comment vérifier que tout marche

Fais ces tests **dans l'ordre**. Les deux premiers sont **gratuits**.

### Test 1 — La base de données tient le coup (gratuit, 5 min) 🔴 le plus important

1. Va sur **https://maxitrouvaille.fr**, ouvre n'importe quelle fiche produit.
2. Descends jusqu'au formulaire « pose ta question », écris `test base de donnees` et envoie.
3. Va sur **https://maxitrouvaille.fr/admin/messages** → ton message doit être là.
4. **Le vrai test :** retourne dans Vercel → **Deployments** → `...` → **Redeploy** → attends le rond vert.
5. Retourne sur `/admin/messages`.
   - ✅ **Le message est toujours là** → la base est branchée. **C'est gagné.**
   - ❌ **Le message a disparu** → la base n'est pas prise en compte. Reprends l'étape 1 au point 12 et dis-le-moi.

*(Pourquoi ce test est malin : un redéploiement efface le fichier temporaire, pas la base de données. Si ton message survit, c'est qu'il est dans le coffre-fort.)*

### Test 2 — Le webhook Stripe répond (gratuit, 2 min)

1. Stripe → **Développeurs** → **Webhooks** → clique sur ton endpoint.
2. **Envoyer un événement test** → `checkout.session.completed` → envoyer.
3. ✅ Réponse **`200`** = branché · ❌ Réponse **`400` « Webhook Stripe non configure »** = la clé n'est pas passée, relis l'avertissement de l'étape 2.

### Test 3 — Un vrai achat de bout en bout (payant, ~10 min) — **à toi de décider**

C'est le seul test qui prouve TOUTE la chaîne. Mais Stripe est en vrai encaissement : **tu payes réellement avec ta carte.**

1. Choisis **le produit le moins cher** de la boutique.
2. Achète-le normalement, avec ta vraie carte, ta vraie adresse.
3. Vérifie, dans l'ordre :
   - [ ] Stripe → **Paiements** : le paiement apparaît
   - [ ] Stripe → **Webhooks** → ton endpoint → l'événement affiche **200**
   - [ ] `maxitrouvaille.fr/admin/pilotage` : la commande apparaît, marquée **payée** (et pas « session créée »)
   - [ ] L'adresse de livraison est complète et correcte
   - [ ] *(si étape 4 faite)* tu as reçu l'email de confirmation dans ta boîte
4. **Puis rembourse-toi :** Stripe → **Paiements** → clique sur le paiement → **Rembourser**.

> 💶 **À savoir avant de le faire :** les frais Stripe de la transaction ne te sont pas forcément rendus lors du remboursement. Prends donc le produit le moins cher. **Et c'est vraiment ton choix — les tests 1 et 2 couvrent déjà l'essentiel sans dépenser un centime.**

### Test 4 — Si tu as fait l'étape 2 bis, referme la porte

- [ ] Si tu avais choisi l'option prudente : Vercel → `ADMIN_MODE` → remets **`false`** → **Save** → **Redeploy**.

---

## 🆘 En cas de problème

### Les 3 réflexes, dans l'ordre

1. **Tu as bien redéployé ?** 9 problèmes sur 10 viennent de là. Une variable enregistrée dans Vercel ne sert à rien tant que le site n'a pas été redéployé. **Deployments → `...` → Redeploy.**
2. **Tu as bien coché « Production » ?** Une variable cochée seulement « Preview » ne s'applique pas au vrai site.
3. **Le champ était vraiment rempli ?** Souviens-toi : texte gris = champ VIDE. Reclique sur **Edit** et regarde la couleur.

### Ce que tu ne fais JAMAIS pour dépanner

- ❌ Supprimer une ligne DNS chez OVH
- ❌ Supprimer ou modifier `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_ENABLE_LIVE_PAYMENTS` ou `NEXT_PUBLIC_SITE_URL` — c'est le paiement, ça marche, on n'y touche pas
- ❌ Supprimer la base de données ou le projet Vercel
- ❌ Payer un abonnement « pour voir si ça débloque »

Si tu es bloqué : **arrête-toi et écris-moi.** Ne force jamais.

### Ce que je te demande de me dire (pour que je trouve vite)

Copie-colle-moi ces 4 lignes en les remplissant :

```
1. J'étais à l'étape n° ___ , au point n° ___
2. Le bouton que j'ai cliqué s'appelait : ___
3. Le message affiché à l'écran, mot pour mot : ___
4. Le test 1 (message qui survit au redéploiement) : ça marche / ça ne marche pas / pas essayé
```

**Ce que tu ne m'envoies jamais :** aucune clé, aucun secret, aucun mot de passe. Ni `whsec_`, ni `re_`, ni `sk-ant-`, ni l'adresse `postgres://`. Je n'en ai pas besoin pour te dépanner. Si tu m'en colles une par erreur, dis-le-moi : on la révoque et on en refait une.

---

## 📋 Récapitulatif — les variables à créer dans Vercel

**Où :** https://vercel.com → projet **maxi-trouvaille** → **Settings** → **Environment Variables**
**Toujours :** cocher **Production**, puis **Save**, puis **Deployments → `...` → Redeploy**.

### À créer / modifier pendant la session

| Nom exact (à taper à l'identique) | À quoi ça sert, en français | Où trouver la valeur | Étape |
|---|---|---|---|
| `DATABASE_URL` *(ou `POSTGRES_URL`)* | Le coffre-fort qui garde tes commandes et tes messages pour toujours, au lieu d'un fichier effaçable. | **Automatique** : Vercel l'ajoute tout seul quand tu crées la base. Sinon : Storage → ta base → « connection string » (commence par `postgres://`). | 1 |
| `STRIPE_WEBHOOK_SECRET` | Permet au site de reconnaître le coup de fil de Stripe qui dit « ce client a payé ». Sans ça, la commande reste « en attente ». | Stripe → Développeurs → Webhooks → ton endpoint → **Signing secret** → Révéler. Commence par `whsec_`. ⚠️ En mode réel, pas en mode test. | 2 |
| `ADMIN_MODE` | Ouvre (`true`) ou ferme (`false`) ton cockpit `/admin`. Existe déjà, à `false`. | **Tu tapes le mot toi-même** : `true` ou `false`. Rien à copier. ⚠️ Pas de mot de passe sur ce cockpit pour l'instant. | 2 bis |
| `RESEND_API_KEY` | Autorise le site à envoyer les emails aux clients (confirmation, expédition). | resend.com → **API Keys** → Create. Commence par `re_`. Affichée une seule fois. | 4 |
| `EMAIL_FROM` | Le nom et l'adresse que le client voit comme expéditeur. | **Tu la tapes toi-même** : `Maxi Trouvaille <commandes@maxitrouvaille.fr>` | 4 |
| `ANTHROPIC_API_KEY` *(optionnel)* | Fait préparer par l'IA des brouillons de réponse aux messages clients. Tu valides avant envoi. | platform.claude.com → **API Keys** → Create Key. Commence par `sk-ant-`. Affichée une seule fois. | 5 |
| `MAXI_SUPPORT_AI_ENABLED` *(optionnel)* | L'interrupteur de l'IA. Sans lui à `true`, la clé ci-dessus ne sert à rien et l'IA reste éteinte. | **Tu tapes le mot toi-même** : `true` pour allumer, `false` pour éteindre. | 5 |

### Les réglages fins — tu n'y touches que si tu en as besoin un jour

Aucun n'est à créer aujourd'hui. Tant qu'ils n'existent pas, le site prend tout seul la valeur la plus prudente.

| Nom exact | À quoi ça sert | Valeur à mettre |
|---|---|---|
| `MAXI_EMAILS_ENABLED` | Bouton d'arrêt d'urgence : coupe **tous** les emails sans supprimer ta clé Resend. | `false` pour tout couper. Absente ou `true` = les emails partent. |
| `EMAIL_REPLY_TO` | L'adresse vers laquelle part la réponse quand un client clique « Répondre » sur ton email. | Par défaut : `contact@maxitrouvaille.fr`. À ne changer que si tu veux une autre boîte. |
| `MAXI_SUPPORT_AI_MODE` | Décide si l'IA prépare un brouillon ou répond toute seule. | Par défaut : **brouillon** (rien ne part sans ton clic). ⚠️ **Ne mets `auto` que quand tu auras plusieurs semaines de recul — et parles-en avec moi avant.** |
| `MAXI_SUPPORT_AI_MODEL` | Quel modèle d'IA écrit les brouillons. | Par défaut : `claude-haiku-4-5` (le moins cher). Un seul mot à changer si tu veux passer à plus puissant et plus cher. |
| `MAXI_SUPPORT_AI_MAX_PER_DAY` | Plafond de sécurité : nombre maximum de brouillons IA par jour. | Par défaut : `50`. C'est un garde-fou anti-emballement. |

### Déjà en place — **NE TOUCHE À RIEN ICI**

| Nom | Ce que c'est |
|---|---|
| `STRIPE_SECRET_KEY` | La clé de paiement. Elle marche. **On n'y touche pas.** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | La clé publique de paiement. **On n'y touche pas.** |
| `STRIPE_ENABLE_LIVE_PAYMENTS` | L'interrupteur du vrai encaissement. **On n'y touche pas.** |
| `NEXT_PUBLIC_SITE_URL` | L'adresse du site. **On n'y touche pas.** |

### Et si tu ne fais rien de tout ça ?

Le site continue **exactement** comme aujourd'hui. Chaque variable est un interrupteur indépendant : tant qu'elle est absente, la fonction correspondante dort et le reste tourne normalement. Tu peux faire l'étape 1 aujourd'hui, la 2 demain, la 4 dans un mois. Rien ne casse, rien ne s'annule.

---

*Guide écrit le 2026-08-02, à partir de l'état réel du site vérifié le jour même. Les interfaces de Vercel, Stripe, Resend et DSers évoluent : si un bouton ne s'appelle plus exactement comme ici, cherche le mot-clé en gras — c'est lui qui compte, pas la formulation exacte.*
