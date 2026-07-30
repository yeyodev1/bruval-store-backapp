import { InferSchemaType, model, Schema } from "mongoose";

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    collection: { type: String, required: true, trim: true },
    categories: { type: [String], default: [] },
    dimensions: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    regularPrice: { type: Number, min: 0 },
    discountPercentage: { type: Number, min: 0, max: 100 },
    webExclusive: { type: Boolean, default: false },
    source: { type: String, trim: true },
    sourceProductId: { type: String, trim: true, unique: true, sparse: true },
    image: { type: String, required: true },
    palette: { type: String, required: true },
    featured: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);

export type ProductDocument = InferSchemaType<typeof productSchema>;
export const Product = model("Product", productSchema);
