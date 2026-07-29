import { CustomError } from "../errors/customError.error";
import { Offer } from "../models/offer.model";

const OFFER_DURATION_MS = 8 * 60 * 60 * 1000;
const DISCOUNT_RATE = 0.15;

export function salePrice(price: number) {
  return Math.round(price * (1 - DISCOUNT_RATE) * 100) / 100;
}

export async function resolveOffer(offerId: unknown) {
  if (typeof offerId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(offerId)) {
    throw new CustomError("El enlace de oferta no es válido", 400);
  }

  let offer = await Offer.findOne({ offerId });
  if (!offer) {
    const expiresAt = new Date(Date.now() + OFFER_DURATION_MS);
    try {
      offer = await Offer.create({ offerId, expiresAt });
    } catch {
      offer = await Offer.findOne({ offerId });
    }
  }
  if (!offer) throw new CustomError("No fue posible preparar la oferta", 500);

  return { active: offer.expiresAt.getTime() > Date.now(), expiresAt: offer.expiresAt };
}
