import { model, Schema } from "mongoose";

const offerSchema = new Schema(
  {
    offerId: { type: String, required: true, unique: true, trim: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const Offer = model("Offer", offerSchema);
