import axios from "axios";
import { NextFunction, Request, Response } from "express";
import { CustomError } from "../errors/customError.error";
import { Order } from "../models/order.model";
import { Product } from "../models/product.model";
import { ensureCatalog } from "../services/catalog.service";
import { sendCheckoutStartedEmail, sendPaymentConfirmedEmail } from "../services/email.service";
import { resolveOffer } from "../services/offer.service";
import { optionalRetailPrice, retailPrice } from "../services/pricing.service";
import { deliveryFeeForZone } from "../services/shipping.service";
import { META_EVENTS, browserIds, clientInfo, hashPhone, hashValue, sendMetaEvent } from "../services/meta.service";

const MINIMUM_DELIVERY_LEAD_MS = 2 * 60 * 60 * 1000;

function catalogCategory(product: { categories?: string[]; source?: string | null }) {
  if (product.categories?.includes("Naturales") || product.source === "bruval.com.ec") return "Naturales";
  return "Preservados";
}

function publicProduct(product: any) {
  return {
    ...product,
    categories: [catalogCategory(product)],
    regularPrice: optionalRetailPrice(
      product.regularPrice && product.regularPrice > product.price ? product.regularPrice : (product.webExclusive ? product.regularPrice : undefined),
    ),
    price: retailPrice(product.price),
  };
}

function storeUrl() {
  return (process.env.STORE_URL || "https://store.bruval.com.ec").replace(/\/+$/, "");
}

function validateDeliveryWindow(date: unknown, timeSlot: unknown) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof timeSlot !== "string") {
    throw new CustomError("Selecciona una fecha y franja de entrega válidas", 400);
  }
  const start = timeSlot.match(/^(\d{2}):00 - \d{2}:00$/)?.[1];
  if (!start) throw new CustomError("Selecciona una franja de entrega válida", 400);

  const deliveryStart = new Date(`${date}T${start}:00:00-05:00`);
  if (Number.isNaN(deliveryStart.getTime()) || deliveryStart.getTime() < Date.now() + MINIMUM_DELIVERY_LEAD_MS) {
    throw new CustomError("La entrega debe solicitarse con al menos dos horas de anticipación", 400);
  }
}

export async function listProducts(_req: Request, res: Response, next: NextFunction) {
  try {
    await ensureCatalog();
    const offer = await resolveOffer(_req.query.offerId);
    const page = Math.max(1, Number(_req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(_req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { available: true };
    const andFilters: any[] = [];

    if (_req.query.category === "Naturales") {
      andFilters.push({ $or: [{ categories: "Naturales" }, { source: "bruval.com.ec" }] });
    } else if (_req.query.category === "Preservados") {
      andFilters.push({ $or: [{ categories: "Preservados" }, { source: { $ne: "bruval.com.ec" } }] });
    }

    if (_req.query.search) {
      const escaped = String(_req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escaped, "i");
      andFilters.push({
        $or: [
          { name: searchRegex },
          { sku: searchRegex },
          { collection: searchRegex },
          { description: searchRegex }
        ]
      });
    }

    if (andFilters.length > 0) {
      filter.$and = andFilters;
    }

    let sortObj: any = { featured: -1, createdAt: 1, _id: 1 };
    if (_req.query.sort === "featured") {
      sortObj = { featured: -1, name: 1 };
    } else if (_req.query.sort === "seasonal") {
      sortObj = { createdAt: -1 };
    } else if (_req.query.sort === "quality") {
      sortObj = { featured: -1, createdAt: 1, _id: 1 };
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
    res.set("Cache-Control", "no-store");
    res.json({
      offer: { active: offer.active, expiresAt: offer.expiresAt },
      products: products.map(publicProduct),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + products.length < total },
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureCatalog();
    const offer = await resolveOffer(req.query.offerId);
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!slug) throw new CustomError("Producto inválido", 400);

    const product = await Product.findOne({ slug, available: true, deletedAt: { $exists: false } }).lean()
      || await Product.findOne({ sku: new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), available: true }).lean();
    if (!product) throw new CustomError("No encontramos este arreglo", 404);

    const related = await Product.find({ _id: { $ne: product._id }, available: true })
      .sort({ featured: -1, createdAt: 1, _id: 1 })
      .limit(3)
      .lean();

    res.set("Cache-Control", "no-store");
    res.json({
      offer: { active: offer.active, expiresAt: offer.expiresAt },
      product: publicProduct(product),
      related: related.map(publicProduct),
    });
  } catch (error) {
    next(error);
  }
}

export async function productsSitemap(_req: Request, res: Response, next: NextFunction) {
  try {
    const products = await Product.find({ available: true }).select("slug updatedAt").sort({ createdAt: 1 }).lean();
    const base = storeUrl();
    const entries = [
      `<url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      ...products.map((product: any) => `<url><loc>${base}/producto/${encodeURIComponent(product.slug)}</loc>${product.updatedAt ? `<lastmod>${new Date(product.updatedAt).toISOString().slice(0, 10)}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.8</priority></url>`),
    ];
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`);
  } catch (error) {
    next(error);
  }
}

/**
 * Recibe los eventos que el Pixel ya disparó en el navegador y los reenvía a la
 * Conversions API con el mismo event_id (Meta los deduplica). No incluye PII.
 */
export async function relayMetaEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventName, eventId, eventSourceUrl, customData, fbp, fbc } = req.body || {};
    if (typeof eventName !== "string" || !META_EVENTS.has(eventName)) throw new CustomError("Evento no permitido", 400);
    if (typeof eventId !== "string" || !/^[\w-]{6,80}$/.test(eventId)) throw new CustomError("Evento inválido", 400);

    res.status(202).json({ accepted: true });

    void sendMetaEvent({
      eventName,
      eventId,
      eventSourceUrl: typeof eventSourceUrl === "string" ? eventSourceUrl.slice(0, 500) : undefined,
      userData: { ...clientInfo(req), ...browserIds({ fbp, fbc }) },
      customData: customData && typeof customData === "object" ? customData : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { items, customer, delivery, offerId, tracking } = req.body;
    if (!Array.isArray(items) || !items.length || !customer?.email || !customer?.name || !customer?.phone || customer.phoneConfirmed !== true || !delivery?.recipient || !delivery?.address || !delivery?.mapUrl || !delivery?.zone || !delivery?.date || !delivery?.timeSlot || !delivery?.messageCard) {
      throw new CustomError("Completa todos los datos de entrega y contacto", 400);
    }
    validateDeliveryWindow(delivery.date, delivery.timeSlot);
    const deliveryFee = deliveryFeeForZone(delivery.zone);

    // El mismo producto puede venir en varias líneas (un color por línea).
    const ids = [...new Set(items.map((item: { productId: string }) => item.productId))];
    const products = await Product.find({ _id: { $in: ids }, available: true }).lean();
    if (products.length !== ids.length) throw new CustomError("Uno de los arreglos ya no está disponible", 400);

    const offer = await resolveOffer(offerId);
    const normalizedItems = items.map((item: { productId: string; quantity: number; variant?: unknown }) => {
      const product = products.find((entry) => entry._id.toString() === item.productId);
      const quantity = Math.max(1, Math.min(10, Number(item.quantity) || 1));
      if (!product) throw new CustomError("Producto inválido", 400);
      const variant = typeof item.variant === "string" ? item.variant.trim().slice(0, 40) || undefined : undefined;
      const name = variant ? `${product.name} · ${variant}` : product.name;
      return { product: product._id, name, sku: product.sku, variant, price: retailPrice(product.price), quantity };
    });
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal + deliveryFee;
    const orderNumber = `BRV-${Date.now().toString(36).toUpperCase()}`;
    const order = await Order.create({
      orderNumber,
      items: normalizedItems,
      subtotal,
      deliveryFee,
      total,
      customer,
      delivery,
      tracking: {
        ...browserIds(tracking || {}),
        eventSourceUrl: typeof tracking?.eventSourceUrl === "string" ? tracking.eventSourceUrl.slice(0, 500) : undefined,
      },
    });

    sendCheckoutStartedEmail(order).catch((error) => console.error("Checkout email failed", error));
    res.status(201).json({ orderNumber, total, payphone: { token: process.env.PAYPHONE_TOKEN?.trim(), storeId: process.env.PAYPHONE_STORE_ID?.trim() } });
  } catch (error) {
    next(error);
  }
}

export async function confirmPayphonePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, clientTransactionId } = req.body;
    if (!id || !clientTransactionId) throw new CustomError("Falta la referencia de Payphone", 400);
    const order = await Order.findOne({ orderNumber: clientTransactionId });
    if (!order) throw new CustomError("Pedido no encontrado", 404);

    // PayPhone redirects can be revisited. A confirmed payment must never be re-checked and downgraded.
    if (order.status === "paid") {
      res.json({
        approved: true,
        orderNumber: order.orderNumber,
        message: "Pago confirmado",
        order: { items: order.items, total: order.total, customer: order.customer, delivery: order.delivery, status: order.status },
      });
      return;
    }

    const { data } = await axios.post(
      "https://paymentbox.payphonetodoesposible.com/api/confirm",
      { id: Number(id), clientTxId: clientTransactionId },
      { headers: { Authorization: `Bearer ${process.env.PAYPHONE_TOKEN?.trim()}`, "Content-Type": "application/json" }, timeout: 15000 },
    );
    const approved = data.statusCode === 3 && data.transactionStatus === "Approved";
    order.status = approved ? "paid" : "payment_failed";
    order.payphone = { transactionId: data.transactionId, authorizationCode: data.authorizationCode, status: data.transactionStatus };
    await order.save();
    if (approved) {
      sendPaymentConfirmedEmail(order).catch((error) => console.error("Payment email failed", error));
      void sendPurchaseToMeta(order, req);
    }

    res.json({
      approved,
      orderNumber: order.orderNumber,
      message: approved ? "Pago confirmado" : "El pago no fue aprobado",
      order: { items: order.items, total: order.total, customer: order.customer, delivery: order.delivery, status: order.status },
    });
  } catch (error) {
    next(error);
  }
}

/** Purchase por Conversions API con datos del comprador (hasheados). Mismo event_id que el Pixel. */
async function sendPurchaseToMeta(order: any, req: Request) {
  if (order.tracking?.purchaseSent) return;
  const [firstName, ...rest] = String(order.customer?.name || "").trim().split(/\s+/);
  await sendMetaEvent({
    eventName: "Purchase",
    eventId: order.orderNumber,
    eventSourceUrl: order.tracking?.eventSourceUrl || `${storeUrl()}/pay-response`,
    userData: {
      em: hashValue(order.customer?.email),
      ph: hashPhone(order.customer?.phone),
      fn: hashValue(firstName),
      ln: hashValue(rest.join(" ")),
      external_id: hashValue(order.orderNumber),
      fbp: order.tracking?.fbp,
      fbc: order.tracking?.fbc,
      ...clientInfo(req),
    },
    customData: {
      currency: "USD",
      value: order.total,
      order_id: order.orderNumber,
      content_type: "product",
      content_ids: order.items.map((item: any) => item.sku || item.name),
      contents: order.items.map((item: any) => ({ id: item.sku || item.name, quantity: item.quantity, item_price: item.price })),
      num_items: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
    },
  });
  await Order.updateOne({ _id: order._id }, { $set: { "tracking.purchaseSent": true } }).catch(() => undefined);
}

export async function lookupOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const value = String(req.body?.value || "").trim();
    if (!value) throw new CustomError("Ingresa tu correo o teléfono", 400);
    const isEmail = value.includes("@");
    const phoneDigits = value.replace(/\D/g, "");
    if (!isEmail && phoneDigits.length < 8) throw new CustomError("Ingresa un teléfono válido", 400);

    const query = isEmail
      ? { "customer.email": value.toLowerCase() }
      : { "customer.phone": { $regex: `${phoneDigits.slice(-9)}$` } };
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(10).lean();
    res.json(orders.map((order) => ({ orderNumber: order.orderNumber, items: order.items, total: order.total, status: order.status, createdAt: order.createdAt, delivery: order.delivery })));
  } catch (error) {
    next(error);
  }
}
