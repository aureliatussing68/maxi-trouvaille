# Emails automatiques Maxi Trouvaille

Ce module envoie trois emails aux clients :

1. **Confirmation de commande** — dès que le paiement est validé par Stripe.
2. **Commande expédiée** — dès que la commande passe au statut « expédié » dans l'admin.
3. **Réponse à un message client** — gabarit prêt, pas encore branché automatiquement.

**Tant que la clé d'envoi n'est pas posée, le site n'envoie AUCUN email et se comporte exactement comme avant.** Rien à désinstaller, rien à annuler.

---

## Ce que tu dois faire (environ 15 minutes)

### 1. Créer le compte Resend (2 min)

- Va sur <https://resend.com>, clique sur « Get Started ».
- Inscris-toi avec Google ou avec ton email.
- Aucune carte bancaire n'est demandée. Si on t'en demande une, tu n'es pas sur l'offre gratuite : reviens en arrière et prends « Free ».

L'offre gratuite : 3 000 emails par mois, 100 par jour. Largement assez pour démarrer.

### 2. Ajouter le domaine maxitrouvaille.fr (3 min)

- Menu de gauche → « Domains » → « Add Domain ».
- Tape `maxitrouvaille.fr`, choisis la région **Europe (Ireland)**.
- Resend affiche un tableau de 3 ou 4 lignes DNS. **Laisse cette page ouverte.**

### 3. Recopier ces lignes chez OVH (5 min)

Le domaine est géré chez OVH (voir `docs/deploiement-domaine.md`).

- <https://www.ovh.com/manager> → Web Cloud → Noms de domaine → maxitrouvaille.fr → onglet « Zone DNS ».
- Pour chaque ligne de Resend : « Ajouter une entrée », copier-coller le type, le nom et la valeur.

**Règle d'or : tu AJOUTES des lignes, tu n'en SUPPRIMES aucune.** Les lignes de Resend visent le sous-domaine `send.maxitrouvaille.fr`, donc `contact@maxitrouvaille.fr` continue de fonctionner normalement. Si OVH propose de remplacer ou supprimer quelque chose, dis non.

### 4. Vérifier (5 minutes à quelques heures d'attente)

Retourne sur Resend → « Verify DNS Records ». Attends que tout passe au vert. Si c'est encore orange, reviens dans une heure.

### 5. Récupérer la clé (2 min)

- Menu → « API Keys » → « Create API Key ».
- Nom : `maxitrouvaille-prod`, permission « Sending access », domaine `maxitrouvaille.fr`.
- La clé commence par `re_`. **Elle n'est affichée qu'une seule fois : copie-la tout de suite.**

### 6. Coller la clé dans Vercel (3 min)

Projet maxi-trouvaille → Settings → Environment Variables, cochées pour **Production** :

| Nom | Valeur |
| --- | --- |
| `RESEND_API_KEY` | la clé `re_...` |
| `EMAIL_FROM` | `Maxi Trouvaille <commandes@maxitrouvaille.fr>` |
| `MAXI_EMAIL_TEST_TOKEN` | un code secret que tu inventes (pour la page de test) |

Puis Deployments → sur le dernier déploiement → « … » → « Redeploy ».

À partir de là, les emails partent tout seuls.

---

## Vérifier que ça marche

Ouvre **<https://maxitrouvaille.fr/api/emails/test>**.

- Tant que `MAXI_EMAIL_TEST_TOKEN` n'existe pas, cette adresse répond « Introuvable » : personne ne peut tomber dessus par hasard.
- Une fois la variable posée, un petit formulaire s'affiche : ton code d'accès, ton adresse email, et le choix de l'email à tester. Clique, et regarde ta boîte de réception (pense aux indésirables).

La page affiche aussi l'état actuel : clé présente ou non, adresse d'expédition, interrupteur.

**Astuce : tu peux tester avant même d'avoir fini le DNS.** Sans `EMAIL_FROM`, le module envoie depuis l'adresse de test `onboarding@resend.dev`, qui n'accepte qu'un seul destinataire : l'adresse de ton compte Resend.

---

## Les interrupteurs

| Variable | À quoi ça sert |
| --- | --- |
| `RESEND_API_KEY` | **L'interrupteur principal.** Absente = aucun email, jamais. |
| `EMAIL_FROM` | L'adresse qui envoie. Par défaut, l'adresse de test Resend. |
| `EMAIL_REPLY_TO` | Où arrivent les réponses des clients. Par défaut `contact@maxitrouvaille.fr`. |
| `MAXI_EMAILS_ENABLED` | Mets `false` pour tout couper d'un coup sans supprimer la clé. |
| `MAXI_EMAIL_TEST_TOKEN` | Code d'accès de la page de test. Absent = page invisible (404). |

---

## Important : à faire AVANT d'allumer

**Branche d'abord la base Postgres.** Sans base, les commandes sont enregistrées dans un fichier temporaire effacé à chaque déploiement. Le marqueur « email déjà envoyé » disparaîtrait avec, et un client pourrait recevoir plusieurs fois le même email de confirmation.

Ordre conseillé : base Postgres → webhook Stripe → clé Resend.

---

## Ce que le code fait exactement (pour un développeur)

- `src/lib/mailer.ts` — envoi via l'API Resend en `fetch` direct, **aucune dépendance npm ajoutée**. Sans clé : journalise et renvoie `{ ok: true, sent: false }`. Ne lève jamais d'exception. Aucune initialisation au niveau module, donc rien ne s'exécute pendant `next build`.
- `src/lib/email-templates.ts` — les trois gabarits (HTML responsive + version texte). Fonctions pures : aucun réseau, aucune variable d'environnement.
- `src/lib/order-emails.ts` — la colle entre les commandes et l'envoi. Chaque fonction commence par vérifier que l'envoi est actif, ne lève jamais d'exception, et ne pose son marqueur anti-doublon qu'après un envoi réussi.
- `src/app/api/stripe/webhook/route.ts` — l'envoi de confirmation est **après** le traitement paiement/stock, dans son propre `try/catch`, et ne change jamais le code HTTP renvoyé à Stripe. Deux cas couverts : commande dropshipping (fiche enregistrée) et commande de stock interne (reconstruite depuis les données Stripe).
- `src/app/api/admin/dropshipping/orders/[orderId]/route.ts` — l'email d'expédition part au passage en statut `expedie`, une seule fois (marqueur `shippingEmailSentAt`), et seulement si la commande est payée.
- `src/app/api/emails/test/route.ts` — la page de test. 404 tant que `MAXI_EMAIL_TEST_TOKEN` est absente.

Aucun chiffre n'est inventé dans les emails : les prix et totaux viennent de la commande et de Stripe, le délai vient du délai déjà affiché sur la fiche produit, sinon du délai de la page `/livraison` (« 7 à 14 jours ouvrés »).

### Limite connue

L'email d'expédition part depuis l'admin. Or `ADMIN_MODE=false` en production : aujourd'hui, il faut piloter les commandes depuis le PC en local (ou remettre l'admin derrière une authentification) pour que cet email parte. La confirmation de commande, elle, part depuis le webhook Stripe : elle fonctionne en production sans rien d'autre.
