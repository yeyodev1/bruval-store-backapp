import { InferSchemaType, model, Schema } from "mongoose";

const adminUserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "advisor"], default: "advisor" },
  },
  { timestamps: true },
);

export type AdminUserDocument = InferSchemaType<typeof adminUserSchema>;
export const AdminUser = model("AdminUser", adminUserSchema);
