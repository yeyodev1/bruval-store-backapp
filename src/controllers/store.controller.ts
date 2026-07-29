import axios from "axios";
import { NextFunction, Request, Response } from "express";
import { CustomError } from "../errors/customError.error";
import { Order } from "../models/order.model";
import { Product } from "../models/product.model";
import { ensureCatalog } from "../services/catalog.service";
import { sendCheckoutStartedEmail, sendPaymentConfirmedEmail } from "../services/email.service";

const DELIVERY_FEE = 4.5;

export async function listProducts(_req: Request, res: Response, next: NextFunction) {
  try {
    await ensureCatalog();
    res.json(await Product.find({ available: true }).sort({ featured: -1, createdAt: 1 }).lean());
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { items, customer, delivery } = req.body;
    if (!Array.isArray(items) || !items.length || !customer?.email || !customer?.name || !customer?.phone || !delivery?.recipient || !delivery?.address || !delivery?.mapUrl || !delivery?.date || !delivery?.timeSlot || !delivery?.messageCard) {
      throw new CustomError("Completa todos los datos de entrega y contacto", 400);
    }

    const ids = items.map((item: { productId: string }) => item.productId);
    const products = await Product.find({ _id: { $in: ids }, available: true }).lean();
    if (products.length !== ids.length) throw new CustomError("Uno de los arreglos ya no está disponible", 400);

    const normalizedItems = items.map((item: { productId: string; quantity: number }) => {
      const product = products.find((entry) => entry._id.toString() === item.productId);
      const quantity = Math.max(1, Math.min(10, Number(item.quantity) || 1));
      if (!product) throw new CustomError("Producto inválido", 400);
      return { product: product._id, name: product.name, price: product.price, quantity };
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

    res.json({ approved, orderNumber: order.orderNumber, message: approved ? "Pago confirmado" : "El pago no fue aprobado" });
  } catch (error) {
    next(error);
  }
}
