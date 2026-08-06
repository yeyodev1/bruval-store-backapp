import bcrypt from "bcryptjs";
import axios from "axios";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { NextFunction, Response } from "express";
import { CustomError } from "../errors/customError.error";
import { AdminUser } from "../models/adminUser.model";
import { Order } from "../models/order.model";
import { Product } from "../models/product.model";
import { AuthRequest } from "../types/AuthRequest";

const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1200&q=85";

async function ensureInitialAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new CustomError("La cuenta administrativa no está configurada", 503);
  if (await AdminUser.exists({ email })) return;
  await AdminUser.create({ name: "Diego Reyes", email, passwordHash: await bcrypt.hash(password, 12), role: "admin" });
}

async function requireAdmin(req: AuthRequest) {
  const user = req.user?.userId ? await AdminUser.findById(req.user.userId).select("role").lean() : null;
  if (user?.role !== "admin") throw new CustomError("No tienes permisos administrativos", 403);
}

export async function loginAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await ensureInitialAdmin();
    const { email, password } = req.body;
    const user = await AdminUser.findOne({ email: String(email || "").toLowerCase() });
    if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new CustomError("Correo o contraseña incorrectos", 401);
    }
    const token = jwt.sign({ userId: user._id.toString(), email: user.email, accountType: "admin" }, process.env.JWT_SECRET as string, { expiresIn: "12h" });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
}

export async function listOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await requireAdmin(req);
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (error) {
    next(error);
  }
}

export async function createAdminUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await requireAdmin(req);
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || password.length < 8) throw new CustomError("Nombre, correo y contraseña de mínimo 8 caracteres son obligatorios", 400);
    if (await AdminUser.exists({ email: String(email).toLowerCase() })) throw new CustomError("Este correo ya tiene acceso", 409);
    const user = await AdminUser.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: role === "admin" ? "admin" : "advisor" });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    next(error);
  }
}

export async function listAdminProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await requireAdmin(req);
    const products = await Product.find({ deletedAt: { $exists: false } }).sort({ available: -1, name: 1 }).lean();
    res.json(products);
  } catch (error) {
    next(error);
  }
}

export async function uploadAdminProductImage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await requireAdmin(req);
    const dataUrl = String(req.body?.image || "");
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/);
    if (!match) throw new CustomError("Selecciona una imagen JPG, PNG o WEBP válida", 400);

    const image = Buffer.from(match[2], "base64");
    if (!image.length || image.length > 10 * 1024 * 1024) throw new CustomError("La imagen debe pesar máximo 10 MB", 400);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new CustomError("La carga de imágenes no está configurada", 503);

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "bruval/catalog";
    const signature = crypto.createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");
    const form = new FormData();
    form.append("file", new Blob([image], { type: match[1] }), "producto");
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("folder", folder);
    form.append("signature", signature);

    const { data } = await axios.post<{ secure_url?: string }>(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, form, { timeout: 120000 });
    if (!data.secure_url) throw new CustomError("No pudimos guardar la imagen", 502);
    res.status(201).json({ url: data.secure_url });
  } catch (error) {
    next(error);
  }
}

export async function createAdminProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await requireAdmin(req);
    const { name, sku, collection, categories, palette, description, dimensions, image, price, regularPrice, available, featured } = req.body;
    if (!name || !sku || !collection || !palette || !dimensions || !description) {
      throw new CustomError("Completa nombre, código, colección, paleta, medidas y descripción", 400);
    }
    const finalPrice = Number(price);
    if (!Number.isFinite(finalPrice) || finalPrice < 0) throw new CustomError("El precio debe ser un valor válido", 400);
    const finalRegularPrice = regularPrice ? Number(regularPrice) : undefined;
    const hasDiscount = Boolean(finalRegularPrice && finalRegularPrice > finalPrice);
    const slug = sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const finalImage = String(image || "").trim() || DEFAULT_PRODUCT_IMAGE;
    const product = await Product.create({
      name: String(name).trim(),
      sku: String(sku).trim(),
      slug,
      collection: String(collection).trim(),
      categories: Array.isArray(categories) ? categories : [],
      palette: String(palette).trim(),
      description: String(description).trim(),
      dimensions: String(dimensions).trim(),
      image: finalImage,
      price: finalPrice,
      regularPrice: hasDiscount ? finalRegularPrice : undefined,
      discountPercentage: hasDiscount ? Math.round((1 - finalPrice / (finalRegularPrice as number)) * 100) : undefined,
      available: available === true,
      featured: featured === true,
    });
    res.status(201).json(product);
  } catch (error: any) {
    if (error?.code === 11000) {
      next(new CustomError("El código SKU ya existe", 409));
    } else {
      next(error);
    }
  }
}

export async function updateAdminProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await requireAdmin(req);
    const product = await Product.findOne({ _id: req.params.id, deletedAt: { $exists: false } });
    if (!product) throw new CustomError("Producto no encontrado", 404);

    const { name, description, sku, collection, categories, palette, dimensions, image, price, regularPrice, available, featured } = req.body;
    if (name !== undefined) product.name = String(name).trim();
    if (description !== undefined) product.description = String(description).trim();
    if (sku !== undefined) {
      product.sku = String(sku).trim();
      product.slug = product.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
    if (collection !== undefined) (product as any).collection = String(collection).trim();
    if (categories !== undefined) product.categories = Array.isArray(categories) ? categories : [];
    if (palette !== undefined) product.palette = String(palette).trim();
    if (dimensions !== undefined) product.dimensions = String(dimensions).trim();
    if (image !== undefined) product.image = String(image).trim();
    if (available !== undefined) product.available = available === true;
    if (featured !== undefined) product.featured = featured === true;
    if (price !== undefined || regularPrice !== undefined) {
      const finalPrice = price !== undefined ? Number(price) : product.price;
      if (!Number.isFinite(finalPrice) || finalPrice < 0) throw new CustomError("El precio final debe ser un valor válido", 400);
      product.price = finalPrice;
      const finalRegular = regularPrice !== undefined ? Number(regularPrice) : product.regularPrice;
      if (finalRegular && finalRegular > finalPrice) {
        product.regularPrice = finalRegular;
        product.discountPercentage = Math.round((1 - finalPrice / finalRegular) * 100);
      } else {
        product.regularPrice = undefined;
        product.discountPercentage = undefined;
      }
    }
    if (!product.name || !product.sku || !product.collection || !product.palette || !product.dimensions || !product.image || !product.description) {
      throw new CustomError("Completa nombre, código, colección, paleta, medidas, descripción e imagen", 400);
    }
    await product.save();
    res.json(product);
  } catch (error) {
    next(error);
  }
}

export async function deleteAdminProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await requireAdmin(req);
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, deletedAt: { $exists: false } },
      { available: false, deletedAt: new Date() },
      { new: true },
    );
    if (!product) throw new CustomError("Producto no encontrado", 404);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
