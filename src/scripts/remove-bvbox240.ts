import dotenv from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { Product } from "../models/product.model";

dotenv.config();

async function main() {
  await dbConnect();
  try {
    const result = await Product.deleteMany({
      $or: [
        { sku: { $regex: /bvbox240/i } },
        { name: { $regex: /bvbox240/i } },
        { description: { $regex: /flower bowls tiny/i } },
      ],
    });
    console.log(`Deleted ${result.deletedCount} products matching BVBOX240.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Error removing BVBOX240:", error);
  process.exitCode = 1;
});
