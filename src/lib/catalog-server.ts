import { promises as fs } from "fs";
import path from "path";
import {
  getCategoryProductFamilyIds,
  getProductBySlug,
  getProductsByCategory,
  isComingSoonProduct,
  isNewProduct,
  isPromotionProduct,
  isPublicProduct,
  products,
  type Product,
} from "@/lib/catalog";
import { hasReviewedOpeningPhoto } from "@/lib/home-rotation";
import { toPublicProduct, type PublicProduct } from "@/lib/public-product";
import { mergeProducts, sanitizeQuickProducts } from "@/lib/quick-products";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");
const publicRootPath = path.join(process.cwd(), "public");

export async function readQuickProducts(): Promise<Product[]> {
  try {
    const content = await fs.readFile(quickProductsPath, "utf8");
    return sanitizeQuickProducts(JSON.parse(content));
  } catch {
    return [];
  }
}

export async function writeQuickProducts(quickProducts: Product[]) {
  await fs.mkdir(path.dirname(quickProductsPath), { recursive: true });
  await fs.writeFile(
    quickProductsPath,
    JSON.stringify(sanitizeQuickProducts(quickProducts), null, 2),
    "utf8",
  );
}

export async function getAllProducts() {
  return mergeProducts(await readQuickProducts());
}

function getProductImageCandidates(product: Product) {
  return Array.from(
    new Set(
      [product.image, ...(Array.isArray(product.images) ? product.images : [])]
        .map((image) => String(image ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function publicImagePath(image: string) {
  const cleanImage = image.split("?")[0];
  const match = cleanImage.match(
    /^\/uploads\/(partner-products|quick-products)\/([a-z0-9][a-z0-9._-]*\.webp)$/i,
  );

  if (!match) {
    return null;
  }

  return path.join(publicRootPath, "uploads", match[1], match[2]);
}

export async function getPublicImageFileBlockers(product: Product) {
  const blockers: string[] = [];
  const images = getProductImageCandidates(product);

  if (images.length === 0) {
    blockers.push("image_file_missing");
  }

  for (const image of images) {
    const localPath = publicImagePath(image);

    if (!localPath) {
      blockers.push("image_not_local_public_upload");
      continue;
    }

    try {
      const stat = await fs.stat(localPath);

      if (!stat.isFile()) {
        blockers.push("image_file_missing");
      }
    } catch {
      blockers.push("image_file_missing");
    }
  }

  return Array.from(new Set(blockers));
}

export async function isServerPublicProduct(product: Product) {
  return isPublicProduct(product) && (await getPublicImageFileBlockers(product)).length === 0;
}

async function filterServerPublicProducts(productList: Product[]) {
  const checkedProducts = await Promise.all(
    productList.map(async (product) => ({
      product,
      isPublic: await isServerPublicProduct(product),
    })),
  );

  return checkedProducts
    .filter((item) => item.isPublic)
    .map((item) => item.product);
}

/**
 * Produits publics COMPLETS — usage strictement serveur.
 *
 * Volontairement NON exporte : cette liste contient encore tout le dossier de
 * sourcing (prix d'achat, marge, lien fournisseur). Elle sert uniquement aux
 * traitements serveur qui en ont besoin, comme le tri des rayons ci-dessous
 * (qui lit dropshipping.lastSyncAt). Tout ce qui sort vers une page passe par
 * toPublicProductList().
 */
async function getPublicSourceProducts() {
  return filterServerPublicProducts(await getAllProducts());
}

/**
 * LA frontiere. Toute liste de produits destinee a une page publique passe
 * par ici, et donc par la liste blanche de src/lib/public-product.ts.
 *
 * Les produits recus sont deja passes par isServerPublicProduct() : leur
 * verdict de publication est donc "vrai" par construction. Le verdict d'achat
 * suit exactement la meme regle que isProductPurchasable() cote catalogue
 * (publie + stock disponible + pas "bientot disponible").
 */
function toPublicProductList(productList: Product[]): PublicProduct[] {
  return productList.map((product) =>
    toPublicProduct(product, {
      isPublic: true,
      isPurchasable: product.stock > 0 && !isComingSoonProduct(product),
    }),
  );
}

export async function getPublicProducts(): Promise<PublicProduct[]> {
  return toPublicProductList(await getPublicSourceProducts());
}

export async function getCatalogProductById(id: string) {
  const staticProduct = products.find((product) => product.id === id);
  if (staticProduct) {
    return staticProduct;
  }

  const quickProducts = await readQuickProducts();
  return quickProducts.find((product) => product.id === id);
}

export async function getCatalogProductBySlug(slug: string) {
  const staticProduct = getProductBySlug(slug);
  if (staticProduct) {
    return staticProduct;
  }

  const quickProducts = await readQuickProducts();
  return quickProducts.find((product) => product.slug === slug);
}

export async function getPublicCatalogProductBySlug(slug: string) {
  const product = await getCatalogProductBySlug(slug);
  return product && (await isServerPublicProduct(product)) ? product : undefined;
}

export async function getCatalogProductsByCategory(categoryId: string) {
  const quickProducts = await readQuickProducts();
  const categoryIds = new Set(getCategoryProductFamilyIds(categoryId));

  return [
    ...getProductsByCategory(categoryId),
    ...quickProducts.filter((product) => categoryIds.has(product.categoryId)),
  ];
}

/**
 * Ordre d'affichage des listes publiques (rayons, nouveautes, promotions).
 *
 * Premier critere : la photo d'ouverture a-t-elle ete relue a l'oeil ? Une
 * bonne moitie des photos fournisseur sont des montages marketing avec du
 * texte etranger incruste ; laissees en tete de liste, elles donnent
 * l'impression d'un catalogue de revente. Elles ne sont pas cachees pour
 * autant, elles passent simplement apres les fiches propres.
 *
 * Second critere, inchange : les arrivages les plus recents d'abord.
 */
function sortNewestPartnerProductsFirst(productList: Product[]) {
  return [...productList].sort((a, b) => {
    const photoRank =
      Number(hasReviewedOpeningPhoto(b)) - Number(hasReviewedOpeningPhoto(a));

    if (photoRank !== 0) {
      return photoRank;
    }

    const bDate = Date.parse(b.dropshipping?.lastSyncAt ?? "") || 0;
    const aDate = Date.parse(a.dropshipping?.lastSyncAt ?? "") || 0;
    return bDate - aDate;
  });
}

export async function getPublicCatalogProductsByCategory(
  categoryId: string,
): Promise<PublicProduct[]> {
  // Le tri s'applique sur les fiches COMPLETES : il lit dropshipping.lastSyncAt,
  // qui ne sort pas au navigateur. Le nettoyage vient donc apres le tri, pour
  // que l'ordre d'affichage des rayons reste rigoureusement identique.
  const publicProducts = await getPublicSourceProducts();

  if (categoryId === "dropshipping-nouveautes") {
    return toPublicProductList(
      sortNewestPartnerProductsFirst(publicProducts.filter(isNewProduct)),
    );
  }

  if (categoryId === "dropshipping-promotions") {
    return toPublicProductList(
      sortNewestPartnerProductsFirst(publicProducts.filter(isPromotionProduct)),
    );
  }

  const categoryIds = new Set(getCategoryProductFamilyIds(categoryId));
  return toPublicProductList(
    sortNewestPartnerProductsFirst(
      publicProducts.filter((product) => categoryIds.has(product.categoryId)),
    ),
  );
}

export async function decrementQuickProductStock(
  items: Array<{ productId: string; quantity: number }>,
) {
  const quickProducts = await readQuickProducts();
  const decrements = new Map(
    items.map((item) => [
      item.productId,
      Math.max(0, Math.trunc(Number(item.quantity)) || 0),
    ]),
  );

  const updatedProducts = quickProducts.map((product) => {
    const quantity = decrements.get(product.id);
    if (!quantity) {
      return product;
    }

    const nextStock = Math.max(0, product.stock - quantity);
    return {
      ...product,
      stock: nextStock,
      badge: nextStock > 0 ? product.badge : "Rupture",
      features: product.features.map((feature) =>
        feature.startsWith("Quantite disponible :")
          ? `Quantite disponible : ${nextStock}`
          : feature,
      ),
    };
  });

  await writeQuickProducts(updatedProducts);
  return updatedProducts;
}
