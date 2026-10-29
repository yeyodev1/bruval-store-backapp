import { Product } from "../models/product.model";

const products = [
  ["Aurora", "Rosas de jardín, lisianthus y eucalipto en una composición de amanecer.", 48, "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1200&q=85", "Blush"],
  ["Luna Rosa", "Peonías suaves, rosas inglesas y textura de nube para decirlo sin palabras.", 62, "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=85", "Rose"],
  ["Sol de Abril", "Girasoles, craspedias y verdes vibrantes con una energía imposible de ignorar.", 42, "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1200&q=85", "Sun"],
  ["Carmesí", "Rosas rojas de tallo largo, bayas y follaje oscuro para un gesto inolvidable.", 58, "https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?auto=format&fit=crop&w=1200&q=85", "Wine"],
  ["Brisa", "Hortensias, delphinium y flor blanca silvestre en una pausa azul y serena.", 52, "https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1200&q=85", "Sky"],
  ["Dulce Vida", "Tulipanes coral, ranúnculos y un toque de mimosa para celebrar lo cotidiano.", 45, "https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=1200&q=85", "Coral"],
  ["Niebla", "Anémonas, rosas crema y eucalipto en una paleta de calma absoluta.", 55, "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=85", "Ivory"],
  ["Violeta", "Iris, alstroemerias y flores de temporada en un arreglo profundo y expresivo.", 46, "https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=1200&q=85", "Violet"],
  ["Jardín Secreto", "Una selección abundante de flores de estación, libre y recién cortada.", 68, "https://images.unsplash.com/photo-1471879832106-c7ab9e0cee23?auto=format&fit=crop&w=1200&q=85", "Garden"],
  ["Siempre", "Orquídeas, rosas y follaje escultórico para los momentos que perduran.", 74, "https://images.unsplash.com/photo-1469259943454-aa100abba749?auto=format&fit=crop&w=1200&q=85", "Orchid"],
] as const;

/**
 * Productos de las landings de campaña que aún no existían en el catálogo.
 * Solo se crean si faltan ($setOnInsert): precio, nombre y fotos se editan
 * desde el admin y nunca se pisan. Precio base provisional hasta que Bruval
 * confirme el real (al público se le suma PRICE_ADJUSTMENT).
 */
const landingProducts = [
  {
    sku: "BVRAMO01",
    slug: "ramo-rosas-preservadas",
    name: "Ramo de rosas preservadas",
    collection: "Rosas preservadas",
    categories: ["Preservados"],
    dimensions: "Medidas por confirmar",
    description: "Rosas rojas preservadas con follaje, armadas en un florero de cerámica blanca con lazo rojo. No necesitan agua y conservan su color por años.",
    price: 109,
    image: "https://store.bruval.com.ec/landings/ramo-rosas-preservadas/01.webp",
    palette: "Rojo",
    featured: true,
  },
];

let landingProductsReady: Promise<unknown> | undefined;

function ensureLandingProducts() {
  landingProductsReady ??= Promise.all(
    landingProducts.map((product) =>
      Product.updateOne({ sku: product.sku }, { $setOnInsert: product }, { upsert: true }),
    ),
  ).catch((error) => {
    landingProductsReady = undefined;
    console.error("No se pudieron crear los productos de las landings", error);
  });
  return landingProductsReady;
}

export async function ensureCatalog() {
  if (await Product.exists({})) return ensureLandingProducts();

  await Product.insertMany(
    products.map(([name, description, price, image, palette], index) => ({
      name,
      sku: `DEMO-${index + 1}`,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      collection: "Catálogo temporal",
      dimensions: "Por confirmar",
      description,
      price,
      image,
      palette,
      featured: index < 3,
    })),
  );
}
