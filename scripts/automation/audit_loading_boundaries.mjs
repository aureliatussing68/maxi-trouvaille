/**
 * Garde-fou : un `loading.tsx` mal place transforme les 404 en 200.
 *
 * CE QUI S'EST PASSE LE 05/08/2026
 * --------------------------------
 * Le site avait un `src/app/loading.tsx`, donc actif partout. Mesure :
 *   /produit/adresse-inexistante   -> 200 au lieu de 404
 *   /categories/adresse-inexistante -> 200 au lieu de 404
 * alors qu'une adresse sans route du tout repondait bien 404.
 *
 * Le mecanisme : un `loading.tsx` cree une frontiere de suspension autour du
 * segment ET de toutes ses routes enfants. Next.js commence a envoyer la
 * reponse (le squelette) avant que la page ait decide s'il y a quelque chose a
 * montrer. Quand la page appelle ensuite notFound(), le code 200 est deja
 * parti. Le visiteur voit la bonne page ; Google enregistre une page valide.
 *
 * LA REGLE VERIFIEE ICI
 * ---------------------
 * Un `loading.tsx` ne peut vivre que dans un segment TERMINAL : aucun `page.tsx`
 * ne doit exister dans un sous-dossier. Un segment terminal n'a pas de route
 * enfant, donc personne en dessous ne peut appeler notFound().
 *
 * Lancer : node scripts/automation/audit_loading_boundaries.mjs
 * Sortie 0 = conforme. Sortie 1 = un squelette est mal place.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const racineProjet = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const racineApp = path.join(racineProjet, "src", "app");

/** Tous les fichiers d'un nom donne, recursivement, en chemins relatifs a src/app. */
async function trouver(nomFichier, dossier = racineApp, prefixe = "") {
  const trouves = [];
  const entrees = await fs.readdir(dossier, { withFileTypes: true });

  for (const entree of entrees) {
    const relatif = prefixe ? `${prefixe}/${entree.name}` : entree.name;

    if (entree.isDirectory()) {
      trouves.push(
        ...(await trouver(
          nomFichier,
          path.join(dossier, entree.name),
          relatif,
        )),
      );
    } else if (entree.name === nomFichier) {
      trouves.push(relatif);
    }
  }

  return trouves;
}

/** Le dossier qui contient ce fichier, "" pour la racine de src/app. */
function dossierDe(cheminRelatif) {
  const morceaux = cheminRelatif.split("/");
  morceaux.pop();
  return morceaux.join("/");
}

const squelettes = await trouver("loading.tsx");
const pages = await trouver("page.tsx");

const fautes = [];

for (const squelette of squelettes) {
  const segment = dossierDe(squelette);
  const prefixe = segment ? `${segment}/` : "";

  // Une page ENFANT est une page situee dans un sous-dossier du segment.
  // La page du segment lui-meme (prefixe + "page.tsx") ne compte pas.
  const enfants = pages.filter(
    (page) => page.startsWith(prefixe) && page !== `${prefixe}page.tsx`,
  );

  if (enfants.length > 0) {
    fautes.push({
      squelette: `src/app/${squelette}`,
      segment: segment || "(racine)",
      enfants: enfants.map((page) => `src/app/${page}`),
    });
  }
}

if (fautes.length === 0) {
  console.log(
    `OK — ${squelettes.length} squelette(s) de chargement, tous sur un segment terminal.`,
  );
  for (const squelette of squelettes) {
    console.log(`   src/app/${squelette}`);
  }
  process.exit(0);
}

console.error("ECHEC — un squelette de chargement couvre des routes enfants.");
console.error(
  "Ces routes repondront 200 au lieu de 404 sur une adresse inexistante.\n",
);

for (const faute of fautes) {
  console.error(`  ${faute.squelette}`);
  console.error(`     couvre ${faute.enfants.length} route(s) enfant :`);
  for (const enfant of faute.enfants.slice(0, 8)) {
    console.error(`       - ${enfant}`);
  }
  if (faute.enfants.length > 8) {
    console.error(`       - ... et ${faute.enfants.length - 8} autre(s)`);
  }
  console.error("");
}

console.error(
  "Correction : deplace le squelette dans les segments terminaux concernes,",
);
console.error(
  "en important src/components/PageSkeleton.tsx, comme le fait deja",
);
console.error("src/app/boutique/loading.tsx.");
process.exit(1);
