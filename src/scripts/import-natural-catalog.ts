import crypto from "crypto";
import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { Product } from "../models/product.model";

dotenv.config();

const SOURCE_API = "https://bruval.com.ec/home/wp-json/wc/store/v1/products";
const CONCURRENCY = 4;

type SourceProduct = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  on_sale: boolean;
  is_in_stock: boolean;
  prices: { price: string; regular_price: string; sale_price: string; currency_minor_unit: number };
  images: Array<{ src: string; name: string }>;
  categories: Array<{ name: string }>;
  formatted_dimensions: string;
};

type ImportedProduct = {
  sourceProductId: string;
  sku: string;
  name: string;
  slug: string;
  collection: string;
  categories: string[];
  dimensions: string;
  description: string;
  price: number;
  regularPrice?: number;
  discountPercentage?: number;
  webExclusive: boolean;
  available: boolean;
  image: string;
  palette: string;
  source: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function cleanText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function money(value: string, minorUnit: number) {
  return Number(value) / 10 ** minorUnit;
}

async function fetchProducts() {
  const first = await axios.get<SourceProduct[]>(SOURCE_API, { params: { per_page: 100, page: 1 }, timeout: 30000 });
  const pages = Number(first.headers["x-wp-totalpages"] || 1);
  const remaining = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => axios.get<SourceProduct[]>(SOURCE_API, { params: { per_page: 100, page: index + 2 }, timeout: 30000 })));
  return [first.data, ...remaining.map((response) => response.data)].flat();
}

async function uploadImage(sourceUrl: string, sourceId: number, cloudName: string, apiKey: string, apiSecret: string) {
  const image = await axios.get<ArrayBuffer>(sourceUrl, { responseType: "arraybuffer", timeout: 60000, maxContentLength: 10 * 1024 * 1024 });
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `bruval/naturales/${sourceId}`;
  const signature = crypto.createHash("sha1").update(`overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([image.data]), `bruval-${sourceId}.webp`);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("signature", signature);
  const { data } = await axios.post<{ secure_url: string }>(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, form, { timeout: 120000 });
  return data.secure_url;
}

async function inBatches<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += CONCURRENCY) {
    const batch = await Promise.all(items.slice(index, index + CONCURRENCY).map(worker));
    results.push(...batch);
    console.log(`Uploaded ${Math.min(index + CONCURRENCY, items.length)}/${items.length} images`);
  }
  return results;
}

async function main() {
  const cloudName = required("CLOUDINARY_CLOUD_NAME");
  const apiKey = required("CLOUDINARY_API_KEY");
  const apiSecret = required("CLOUDINARY_API_SECRET");
  const sourceProducts = (await fetchProducts()).filter((p) => p.sku?.toUpperCase() !== "BVBOX240");
  if (!sourceProducts.length) throw new Error("The source catalog returned no products");

  const imported = await inBatches(sourceProducts, async (source): Promise<ImportedProduct> => {
    const image = source.images[0]?.src;
    if (!image) throw new Error(`${source.id} has no product image`);
    const categories = source.categories.map((category) => category.name);
    const regularPrice = money(source.prices.regular_price || source.prices.price, source.prices.currency_minor_unit);
    const price = money(source.prices.price, source.prices.currency_minor_unit);
    const webExclusive = source.on_sale && regularPrice > price;
    return {
      sourceProductId: String(source.id),
      sku: source.sku || `BRUVAL-${source.id}`,
      name: source.name,
      slug: source.slug,
      collection: categories[0] || "Flores naturales",
      categories: ["Naturales"],
      dimensions: source.formatted_dimensions && source.formatted_dimensions !== "N/D" ? source.formatted_dimensions : "Medidas por confirmar",
      description: cleanText(source.description) || source.name,
      price,
      regularPrice: webExclusive ? regularPrice : undefined,
      discountPercentage: webExclusive ? Math.round((1 - price / regularPrice) * 100) : undefined,
      webExclusive,
      available: source.is_in_stock,
      image: await uploadImage(image, source.id, cloudName, apiKey, apiSecret),
      palette: categories[0] || "Natural",
      source: "bruval.com.ec",
    };
  });

  await dbConnect();
  try {
    await Product.deleteMany({ sku: { $regex: /^BVBOX240$/i } });
    await Product.updateMany({ source: "bruval.com.ec" }, { $set: { available: false } });
    await Product.bulkWrite(imported.map((product) => ({
      updateOne: {
        filter: { sourceProductId: product.sourceProductId },
        update: { $set: product },
        upsert: true,
      },
    })));
    console.log(`Synchronized ${imported.length} natural products.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  if (axios.isAxiosError(error)) console.error(error.response?.data || error.message);
  else console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
