import dns from "node:dns";
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { Product } from "../models/product.model";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

const execFileAsync = promisify(execFile);
const CLOUDINARY_MAX_FILE_SIZE = 10 * 1024 * 1024;

type CatalogProduct = {
  sku: string;
  name: string;
  collection: string;
  dimensions: string;
  price: number;
  regularPrice?: number;
  discountPercentage?: number;
  webExclusive?: boolean;
  description: string;
  imageFile: string;
  palette: string;
  categories?: string[];
};

const catalog: CatalogProduct[] = [
  { sku: "RP35", name: "Rosa preservada", collection: "Rosas preservadas", dimensions: "21 x 24 cm", price: 79, description: "Rosa preservada talla extra large con tallo, hojas y musgo preservado.", imageFile: "033.png", palette: "Rojo" },
  { sku: "RP40", name: "Rosa preservada", collection: "Rosas preservadas", dimensions: "18 x 27 cm", price: 65, description: "Rosa preservada talla extra large decorada con tallo, hojas y musgo preservado.", imageFile: "047.png", palette: "Rojo" },
  { sku: "RP45", name: "Rosas preservadas", collection: "Rosas preservadas", dimensions: "24 x 40 cm", price: 129, description: "Dos rosas preservadas talla extra large con tallo, hojas y musgo preservado.", imageFile: "026.png", palette: "Rojo" },
  { sku: "RP50", name: "Rosa y girasol preservados", collection: "Rosas preservadas", dimensions: "21 x 24 cm", price: 89, description: "Rosa preservada talla extra large y girasol preservado talla small, con tallos, hojas y musgo preservado.", imageFile: "035.png", palette: "Rojo" },
  { sku: "RP55", name: "Cúpula pequeña girasol", collection: "Girasoles preservados", dimensions: "18 x 20 cm", price: 59, description: "Girasol preservado tamaño large con tallo, hojas y musgo preservado.", imageFile: "RP-55.png", palette: "Girasol" },
  { sku: "RP60", name: "Cúpula mediana girasol", collection: "Girasoles preservados", dimensions: "18 x 27 cm", price: 75, description: "Girasol preservado tamaño XL decorado con tallo, hojas y musgo preservado.", imageFile: "RP-60.png", palette: "Girasol" },
  { sku: "RP65", name: "Esfera girasol doble", collection: "Girasoles preservados", dimensions: "15 x 20 cm", price: 69, description: "Dos girasoles preservados tamaño petit decorados con tallo, hojas y musgo preservado.", imageFile: "RP-65.png", palette: "Girasol" },
  { sku: "RP70", name: "Small girasol niños", collection: "Girasoles preservados", dimensions: "15 x 16 cm", price: 80, description: "Girasol preservado talla small con tallo, hojas y musgo, decorado con una romántica pareja de niños de resina.", imageFile: "RP-70.png", palette: "Girasol" },
  { sku: "RP75", name: "Tiny girasol", collection: "Girasoles preservados", dimensions: "10 x 10 cm", price: 38, description: "Girasol preservado talla small decorado con hojas y musgo preservado.", imageFile: "RP-75.png", palette: "Girasol" },
  { sku: "RP80", name: "Ángel girasol", collection: "Girasoles preservados", dimensions: "6.5 x 10 cm", price: 38, description: "Girasol tamaño petit en una decoración exclusiva de un ángel de cristal sobre base de madera.", imageFile: "RP-80.png", palette: "Girasol" },
  { sku: "RP85", name: "Árbol de amor", collection: "Árbol de Amor", dimensions: "18 x 27 cm", price: 99, description: "Decoración exclusiva en tronco natural preservado con gypsophilia y musgo preservado.", imageFile: "042.png", palette: "Rojo" },
  { sku: "RP90", name: "Árbol de amor", collection: "Árbol de Amor", dimensions: "14 x 27 cm", price: 115, description: "Decoración exclusiva en tronco natural preservado con gypsophilia y musgo preservado.", imageFile: "037.png", palette: "Rojo" },
  { sku: "RP95", name: "Árbol de amor", collection: "Árbol de Amor", dimensions: "18 x 20 cm", price: 79, description: "Decoración exclusiva en tronco natural preservado con gypsophilia y musgo preservado.", imageFile: "062.png", palette: "Multicolor" },
  { sku: "RP100", name: "Árbol de amor", collection: "Árbol de Amor", dimensions: "10 x 18 cm", price: 59, description: "Decoración exclusiva en tronco natural preservado con gypsophilia y musgo preservado.", imageFile: "RP-100.png", palette: "Rojo" },
  { sku: "RP130", name: "Cúpula corazón de mini rosas rojas", collection: "Love Collection", dimensions: "21 x 24 cm", price: 149, description: "Corazón entero de mini rosas rojas preservadas con musgo preservado.", imageFile: "RP-130.png", palette: "Rojo" },
  { sku: "RP135", name: "Cúpula XL Deluxe corazón de rosas rojas", collection: "Love Collection", dimensions: "30 x 42 cm", price: 279, description: "Corazón de rosas preservadas tamaño small con tallos y un lazo como detalle final.", imageFile: "RP-135.png", palette: "Rojo" },
  { sku: "RP140", name: "Caja acrílica negra corazón de mini rosas rojas", collection: "Love Collection", dimensions: "24 x 24 cm", price: 159, description: "Caja cuadrada acrílica de fondo negro con mini rosas preservadas formando un corazón romántico.", imageFile: "RP-140.png", palette: "Rojo" },
  { sku: "RP145", name: "Cúpula corazón de mini rosas rojas con niños", collection: "Love Collection", dimensions: "21 x 24 cm", price: 149, description: "Corazón de mini rosas preservadas con una romántica pareja de niños de resina y un girasol preservado talla small.", imageFile: "RP-145.png", palette: "Rojo" },
  { sku: "RP105", name: "Cúpula Virgen María", collection: "Celestial Collection", dimensions: "19 x 38 cm", price: 149, regularPrice: 199, webExclusive: true, discountPercentage: 25, description: "Regala paz y fe con nuestra Celestial Collection. Cupula de cristal, Figura de la virgen Maria, Decoracion con rosas, mini rosas y musgo preservado.", imageFile: "024.png", palette: "Rojo" },
  { sku: "RP110", name: "Cúpula Virgen María XL", collection: "Celestial Collection", dimensions: "30 x 42 cm", price: 275, regularPrice: 399, webExclusive: true, discountPercentage: 31, description: "Regala paz y fe con nuestra Celestial Collection. Cupula de Cristal, figura de la Virgen Maria, Decoracion de Rosas preservadas en tamaño Large.", imageFile: "021.png", palette: "Rojo" },
  { sku: "RP115", name: "Cúpula Virgen María", collection: "Celestial Collection", dimensions: "15 x 16 cm", price: 49, regularPrice: 68, webExclusive: true, discountPercentage: 28, description: "Regala paz y fe con nuestra Celestial Collection. Cupula de cristal, figura de la virgen Maria, una rosa preservada en tamaño large.", imageFile: "108.png", palette: "Rojo" },
  { sku: "RP120", name: "Cúpula Virgen María con Flores", collection: "Celestial Collection", dimensions: "15 x 16 cm", price: 59, regularPrice: 73, webExclusive: true, discountPercentage: 19, description: "Regala paz y fe con nuestra Celestial Collection. Cupula de cristal, figura de la virgen maria, decoracion con mini rosas, hortensias y gypsofilia preservada.", imageFile: "106.png", palette: "Rojo" },
  { sku: "RP125", name: "Cúpula Virgen María con Girasol", collection: "Celestial Collection", dimensions: "15 x 16 cm", price: 59, regularPrice: 75, webExclusive: true, discountPercentage: 21, description: "Regala paz y fe con nuestra Celestial Collection. cupula de Cristal, figura de la Virgen Maria, Decoracion de un girasol preservado en tamaño small.", imageFile: "101.png", palette: "Girasol" },
  { sku: "RP015", name: "Rosa preservada", collection: "Rosas preservadas", dimensions: "18 x 20 cm", price: 49, regularPrice: 82, webExclusive: true, discountPercentage: 40, description: "Sorprende con un regalo que perdura. Nuestra rosa preservada en cúpula de cristal mantiene su belleza por mucho tiempo y simboliza un amor que nunca se marchita. Producto contiene: Rosa tamaño large decorada con tallo y musgo preservado.", imageFile: "071.png", palette: "Rojo" },
  { sku: "RP030", name: "Rosa preservada con Niños", collection: "Rosas preservadas", dimensions: "16 x 15 cm", price: 49, regularPrice: 78, webExclusive: true, discountPercentage: 37, description: "Sorprende con un regalo que perdura. Nuestra rosa preservada en cúpula de cristal mantiene su belleza por mucho tiempo y simboliza un amor que nunca se marchita. Producto contiene: Rosa tamaño large decorada con figura de niños de resina *Las figuras pueden cambiar según el stock.", imageFile: "105.png", palette: "Rojo" },
  { sku: "RP020", name: "Rosa preservada Extra Large", collection: "Rosas preservadas", dimensions: "12 x 12 cm", price: 45, regularPrice: 66, webExclusive: true, discountPercentage: 32, description: "Sorprende con un regalo que perdura. Nuestra rosa preservada en cúpula de cristal y base metalizada color dorado mantiene su belleza por mucho tiempo y simboliza un amor que nunca se marchita. Producto contiene: Rosa tamaño Extra large decorada con hojas y musgo preservado.", imageFile: "115.png", palette: "Rojo" },
  { sku: "RP025", name: "Rosa preservada", collection: "Rosas preservadas", dimensions: "10 x 10 cm", price: 35, regularPrice: 49, webExclusive: true, discountPercentage: 29, description: "Sorprende con un regalo que perdura. Nuestra rosa preservada en cúpula de cristal y base metalizada color dorado mantiene su belleza por mucho tiempo y simboliza un amor que nunca se marchita. Producto contiene: Rosa preservada tamaño large con decoracion de musgo y hojas preservadas.", imageFile: "158.png", palette: "Rojo" },
];

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function uploadImage(filePath: string, sku: string, cloudName: string, apiKey: string, apiSecret: string) {
  const stat = await fs.stat(filePath);
  const optimizedPath = path.join(os.tmpdir(), `bruval-${sku.toLowerCase()}.jpg`);
  let uploadPath = stat.size > CLOUDINARY_MAX_FILE_SIZE ? optimizedPath : filePath;
  let optimizationFailed = false;
  if (uploadPath === optimizedPath) {
    try {
      if (process.platform === "darwin") {
        await execFileAsync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", "--resampleWidth", "2000", filePath, "--out", optimizedPath]);
      } else if (process.platform === "win32") {
        const psCommand = `
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap('${filePath}')
$width = $bmp.Width
$height = $bmp.Height
if ($width -gt 2000) {
  $height = [int]($height * (2000 / $width))
  $width = 2000
}
$resized = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($resized)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bmp, 0, 0, $width, $height)
$g.Dispose()
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatDescription -eq 'JPEG' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 85)
$resized.Save('${optimizedPath}', $jpegCodec, $encoderParams)
$resized.Dispose()
$bmp.Dispose()
`;
        await execFileAsync("powershell", ["-NoProfile", "-Command", psCommand]);
      } else {
        throw new Error("Unsupported platform");
      }
      console.log(`Optimized image for ${sku} successfully.`);
    } catch (err: any) {
      console.warn(`[WARN] Failed to optimize image using native tool (${err.message}). Uploading original file.`);
      uploadPath = filePath;
      optimizationFailed = true;
    }
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `bruval/catalog/${sku.toLowerCase()}`;
  const signature = crypto.createHash("sha1").update(`overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([await fs.readFile(uploadPath)]), path.basename(uploadPath));
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("signature", signature);

  try {
    const { data } = await axios.post<{ secure_url: string }>(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, form, { timeout: 120000 });
    return data.secure_url;
  } finally {
    if (uploadPath === optimizedPath && !optimizationFailed) {
      await fs.rm(optimizedPath, { force: true });
    }
  }
}

async function main() {
  const cloudName = required("CLOUDINARY_CLOUD_NAME");
  const apiKey = required("CLOUDINARY_API_KEY");
  const apiSecret = required("CLOUDINARY_API_SECRET");
  const imagesDir = required("PRODUCT_IMAGES_DIR");

  await dbConnect();
  try {
    const productsToSync = [];
    for (const product of catalog) {
      const imagePath = path.join(imagesDir, product.imageFile);
      let imageExists = false;
      try {
        await fs.access(imagePath);
        imageExists = true;
      } catch {}

      let imageUrl = "";
      if (imageExists) {
        console.log(`Uploading local image for ${product.sku}...`);
        imageUrl = await uploadImage(imagePath, product.sku, cloudName, apiKey, apiSecret);
      } else {
        // Find existing product in DB to reuse its image
        const existing = await Product.findOne({ sku: product.sku }).lean();
        if (existing?.image) {
          console.log(`Reusing existing image from DB for ${product.sku}`);
          imageUrl = existing.image;
        } else {
          console.warn(`Warning: Image ${product.imageFile} does not exist locally and no product found in DB.`);
          continue;
        }
      }
      productsToSync.push({ ...product, image: imageUrl });
    }

    // Set non-WooCommerce products to available: false temporarily
    await Product.updateMany({ source: { $ne: "bruval.com.ec" } }, { $set: { available: false } });

    await Product.bulkWrite(productsToSync.map((product, index) => ({
      updateOne: {
        filter: { sku: product.sku },
        update: { $set: { ...product, categories: product.categories || ["Preservados"], slug: slug(product.sku), featured: index < 3, available: true } },
        upsert: true,
      },
    })));
    console.log(`Uploaded and synchronized ${productsToSync.length} products.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  if (axios.isAxiosError(error)) {
    console.error(error.response?.data || error.message);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
