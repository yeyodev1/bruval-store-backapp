import { Resend } from "resend";
import { OrderDocument } from "../models/order.model";

function orderRows(order: OrderDocument) {
  return order.items
    .map((item) => `<tr><td style="padding:8px 0">${item.quantity} x ${item.name}</td><td style="padding:8px 0;text-align:right">$${(item.price * item.quantity).toFixed(2)}</td></tr>`)
    .join("");
}

async function send(order: OrderDocument, subject: string, heading: string, copy: string, event: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const customer = order.customer;
  const delivery = order.delivery;
  if (!customer || !delivery) {
    console.error("Unable to send incomplete order email", order.orderNumber);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM || "Bruval Flores <bruval@bakano.ec>",
    to: [customer.email],
    subject,
    headers: { "Idempotency-Key": `${event}/${order.orderNumber}` },
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;color:#29231f"><p style="letter-spacing:2px;text-transform:uppercase;font:12px Arial,sans-serif;color:#a06554">Bruval Flores</p><h1 style="font-size:32px;font-weight:400">${heading}</h1><p style="font:16px/1.6 Arial,sans-serif">${copy}</p><div style="margin:28px 0;padding:20px;background:#f8f1eb"><strong>Pedido ${order.orderNumber}</strong><table style="width:100%;font:14px Arial,sans-serif">${orderRows(order)}<tr><td style="padding-top:14px"><strong>Total</strong></td><td style="padding-top:14px;text-align:right"><strong>$${order.total.toFixed(2)}</strong></td></tr></table></div><p style="font:14px/1.6 Arial,sans-serif">Entrega para ${delivery.recipient} el ${delivery.date}, ${delivery.timeSlot}.</p></div>`,
  });

  if (error) console.error("Unable to send order email", error);
}

export async function sendCheckoutStartedEmail(order: OrderDocument) {
  await send(order, `Tu selección está lista | ${order.orderNumber}`, "Tu selección está lista", "Recibimos los detalles de tu entrega. Completa el pago seguro para reservar tus flores.", "checkout-started");
}

export async function sendPaymentConfirmedEmail(order: OrderDocument) {
  await send(order, `Pedido confirmado | ${order.orderNumber}`, "Tu pedido florece", "Tu pago fue aprobado. Nuestro equipo preparará cada flor para que llegue en el momento indicado.", "payment-confirmed");
}
