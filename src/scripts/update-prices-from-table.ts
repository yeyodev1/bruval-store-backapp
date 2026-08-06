import dotenv from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { Product } from "../models/product.model";

dotenv.config();

const items = [
  {
    sku: "RP45",
    regularPrice: 179,
    price: 129,
    description: "Detalles exclusivos que conservan la belleza de las flores por mucho tiempo. Producto contiene: 2 Rosas preservadas en talla Extra Large decoradas con tallos, hojas y musgo preservado",
  },
  {
    sku: "RP35",
    regularPrice: 99,
    price: 79,
    description: "Detalles exclusivos que conservan la belleza de las flores por mucho tiempo. Producto contiene: Rosa preservada en talla Extra Large con tallo, hojas y musgo preservado.",
  },
  {
    sku: "RP50",
    regularPrice: 119,
    price: 89,
    description: "Detalles exclusivos que conservan la belleza de las flores por mucho tiempo. Producto contiene Rosa preservada talla Extra Large, Girasol preservado talla Small decorado con tallos, hojas y musgo preservado.",
  },
  {
    sku: "RP40",
    regularPrice: 110,
    price: 65,
    description: "Detalles exclusivos que conservan la belleza de las flores por mucho tiempo. Producto contiene: Rosa preservada tamaño Extra Large decorado con Tallo, hojas y musgo preservado.",
  },
];

async function main() {
  await dbConnect();
  try {
    for (const item of items) {
      const discountPercentage = Math.round((1 - item.price / item.regularPrice) * 100);
      const res = await Product.updateOne(
        { sku: item.sku },
        {
          $set: {
            price: item.price,
            regularPrice: item.regularPrice,
            discountPercentage,
            description: item.description,
          },
        }
      );
      console.log(`Updated SKU ${item.sku}: modified ${res.modifiedCount} document(s).`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Error updating prices:", error);
  process.exitCode = 1;
});
