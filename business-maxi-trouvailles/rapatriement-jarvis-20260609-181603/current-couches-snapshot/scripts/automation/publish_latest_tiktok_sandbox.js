// Sandbox-friendly variant of C:\Users\sinek\Desktop\MAXI_TROUVAILLE\scripts\publish_latest_tiktok.js
// - Output/manifest dir configurable via env so Codex can write inside the workspace.
// - Safety: if TikTok asks for login/code/captcha, exits with manual_needed.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const TIKTOK_DIR = process.env.MAXI_TIKTOK_DIR || "C:\\Users\\sinek\\Desktop\\TIKTOK";
const MANIFEST_PATH = path.join(TIKTOK_DIR, "latest_maxi_tiktok_manifest.json");
const SCREENSHOT_PATH = path.join(TIKTOK_DIR, "latest_tiktok_publish_state.png");

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

async function bodyText(page) {
  return await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
}

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest introuvable: ${MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!manifest.video || !fs.existsSync(manifest.video)) {
    throw new Error(`Video introuvable: ${manifest.video}`);
  }

  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0] || (await browser.newContext());
  let page =
    context.pages().find((p) => p.url().includes("tiktokstudio/upload")) ||
    context.pages().find((p) => p.url().includes("tiktok.com")) ||
    (await context.newPage());

  await page.bringToFront();
  await page
    .goto("https://www.tiktok.com/tiktokstudio/upload?lang=fr", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    })
    .catch((error) => {
      manifest.publishStatus = "blocked";
      manifest.publishError = `Impossible d'ouvrir TikTok Studio: ${error.message}`;
    });

  await page.waitForTimeout(5000);
  const initialText = await bodyText(page);
  if (/se connecter|connexion|inscription|mot de passe|code de vérification|captcha/i.test(initialText)) {
    manifest.publishStatus = "manual_needed";
    manifest.publishError = "TikTok demande une connexion, un code ou une validation sensible.";
    saveManifest(manifest);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
    await browser.close();
    console.log(JSON.stringify({ status: manifest.publishStatus, reason: manifest.publishError }));
    return;
  }

  const fileInputs = await page.locator('input[type="file"]').count();
  if (!fileInputs) {
    manifest.publishStatus = "blocked";
    manifest.publishError = "Aucun champ d'upload video trouvé sur TikTok Studio.";
    saveManifest(manifest);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
    await browser.close();
    console.log(JSON.stringify({ status: manifest.publishStatus, reason: manifest.publishError }));
    return;
  }

  await page.locator('input[type="file"]').first().setInputFiles(manifest.video);

  let ready = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(5000);
    const text = await bodyText(page);
    if (/Importé|Description|Publier|Vérifications|Couverture/i.test(text) && /Publier/i.test(text)) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    manifest.publishStatus = "blocked";
    manifest.publishError = "Upload TikTok non prêt après attente.";
    saveManifest(manifest);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
    await browser.close();
    console.log(JSON.stringify({ status: manifest.publishStatus, reason: manifest.publishError }));
    return;
  }

  const afterUploadText = await bodyText(page);
  if (/se connecter|connexion|mot de passe|code de vérification|captcha/i.test(afterUploadText)) {
    manifest.publishStatus = "manual_needed";
    manifest.publishError = "TikTok demande une validation sensible pendant l'upload.";
    saveManifest(manifest);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
    await browser.close();
    console.log(JSON.stringify({ status: manifest.publishStatus, reason: manifest.publishError }));
    return;
  }

  if (afterUploadText.includes("Activer les vérifications automatiques")) {
    await page.getByText("Activer", { exact: true }).click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }

  const caption =
    manifest.caption ||
    "Maxi Trouvailles - bonnes affaires et déstockage sur https://maxitrouvaille.fr #maxitrouvaille #destockage";
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click({ timeout: 10000 });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(caption, { delay: 4 });

  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(5000);
    const text = await bodyText(page);
    if (/Aucun problème constaté/i.test(text) || (!/Vérification en cours/i.test(text) && /Publier/i.test(text))) {
      break;
    }
  }

  await page.getByText("Publier", { exact: true }).click({ timeout: 15000 }).catch(async () => {
    await page.locator("button").filter({ hasText: "Publier" }).first().click({ timeout: 15000 });
  });

  let published = false;
  for (let i = 0; i < 36; i++) {
    await page.waitForTimeout(5000);
    const text = await bodyText(page);
    if (page.url().includes("tiktokstudio/content") && /Vidéo publiée|Contenu \\(Créé le\\)|Publications/i.test(text)) {
      published = true;
      break;
    }
    if (/se connecter|connexion|mot de passe|code de vérification|captcha/i.test(text)) {
      manifest.publishStatus = "manual_needed";
      manifest.publishError = "TikTok demande une validation sensible après clic Publier.";
      saveManifest(manifest);
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
      await browser.close();
      console.log(JSON.stringify({ status: manifest.publishStatus, reason: manifest.publishError }));
      return;
    }
  }

  manifest.publishStatus = published ? "published" : "blocked";
  manifest.publishedAt = new Date().toISOString();
  if (!published) {
    manifest.publishError = "Publication non confirmée (page de contenu non détectée).";
  }
  saveManifest(manifest);
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
  await browser.close();
  console.log(JSON.stringify({ status: manifest.publishStatus, reason: manifest.publishError || null }));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

