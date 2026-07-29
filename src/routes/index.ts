import express, { Application } from "express";
import { confirmPayphonePayment, createOrder, listProducts } from "../controllers/store.controller";

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.get("/products", listProducts);
  router.post("/orders", createOrder);
  router.post("/payments/payphone/confirm", confirmPayphonePayment);
}

export default routerApi;
