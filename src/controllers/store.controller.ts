import axios from "axios";
import { NextFunction, Request, Response } from "express";
import { CustomError } from "../errors/customError.error";
import { Order } from "../models/order.model";
import { Product } from "../models/product.model";
import { ensureCatalog } from "../services/catalog.service";
import { sendCheckoutStartedEmail, sendPaymentConfirmedEmail } from "../services/email.service";
import { resolveOffer, salePrice } from "../services/offer.service";

const DELIVERY_FEE = 4.5;
const MINIMUM_DELIVERY_LEAD_MS = 2 * 60 * 60 * 1000;

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
    const products = await Product.find({ available: true }).sort({ featured: -1, createdAt: 1 }).lean();
    res.json({
      offer: { active: offer.active, expiresAt: offer.expiresAt },
      products: products.map((product) => ({
        ...product,
        regularPrice: offer.active ? product.price : undefined,
        price: offer.active ? salePrice(product.price) : product.price,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { items, customer, delivery, offerId } = req.body;
    if (!Array.isArray(items) || !items.length || !customer?.email || !customer?.name || !customer?.phone || customer.phoneConfirmed !== true || !delivery?.recipient || !delivery?.address || !delivery?.mapUrl || !delivery?.date || !delivery?.timeSlot || !delivery?.messageCard) {
      throw new CustomError("Completa todos los datos de entrega y contacto", 400);
    }
    validateDeliveryWindow(delivery.date, delivery.timeSlot);

    const ids = items.map((item: { productId: string }) => item.productId);
    const products = await Product.find({ _id: { $in: ids }, available: true }).lean();
    if (products.length !== ids.length) throw new CustomError("Uno de los arreglos ya no está disponible", 400);

    const offer = await resolveOffer(offerId);
    const normalizedItems = items.map((item: { productId: string; quantity: number }) => {
      const product = products.find((entry) => entry._id.toString() === item.productId);
      const quantity = Math.max(1, Math.min(10, Number(item.quantity) || 1));
      if (!product) throw new CustomError("Producto inválido", 400);
      return { product: product._id, name: product.name, price: offer.active ? salePrice(product.price) : product.price, quantity };
    });
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal + DELIVERY_FEE;
    const orderNumber = `BRV-${Date.now().toString(36).toUpperCase()}`;
    const order = await Order.create({ orderNumber, items: normalizedItems, subtotal, deliveryFee: DELIVERY_FEE, total, customer, delivery });

    sendCheckoutStartedEmail(order).catch((error) => console.error("Checkout email failed", error));
    res.status(201).json({ orderNumber, total, payphone: { token: process.env.PAYPHONE_TOKEN, storeId: process.env.PAYPHONE_STORE_ID } });
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

    const { data } = await axios.post(
      "https://paymentbox.payphonetodoesposible.com/api/confirm",
      { id: Number(id), clientTxId: clientTransactionId },
      { headers: { Authorization: `Bearer ${process.env.PAYPHONE_TOKEN}`, "Content-Type": "application/json" }, timeout: 15000 },
    );
    const approved = data.statusCode === 3 && data.transactionStatus === "Approved";
    order.status = approved ? "paid" : "payment_failed";
    order.payphone = { transactionId: data.transactionId, authorizationCode: data.authorizationCode, status: data.transactionStatus };
    await order.save();
    if (approved) sendPaymentConfirmedEmail(order).catch((error) => console.error("Payment email failed", error));

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
