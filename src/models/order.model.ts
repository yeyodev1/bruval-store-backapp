import { InferSchemaType, model, Schema } from "mongoose";

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      phoneConfirmed: { type: Boolean, required: true },
    },
    delivery: {
      recipient: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      mapUrl: { type: String, required: true, trim: true },
      zone: { type: String, required: true, trim: true },
      date: { type: String, required: true, trim: true },
      timeSlot: { type: String, required: true, trim: true },
      messageCard: { type: String, required: true, trim: true },
    },
    status: {
      type: String,
      enum: ["awaiting_payment", "paid", "payment_failed"],
      default: "awaiting_payment",
    },
    payphone: {
      transactionId: Number,
      authorizationCode: String,
      status: String,
    },
    /** Identificadores del Pixel de Meta para atribuir la compra en la Conversions API. */
    tracking: {
      fbp: { type: String, trim: true },
      fbc: { type: String, trim: true },
      eventSourceUrl: { type: String, trim: true },
      purchaseSent: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export type OrderDocument = InferSchemaType<typeof orderSchema>;
export const Order = model("Order", orderSchema);
