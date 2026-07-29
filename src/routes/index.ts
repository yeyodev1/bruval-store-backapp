import express, { Application } from "express";
import { confirmPayphonePayment, createOrder, listProducts, lookupOrders } from "../controllers/store.controller";
import { createAdminUser, listOrders, loginAdmin } from "../controllers/admin.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.get("/products", listProducts);
  router.post("/orders", createOrder);
  router.post("/orders/lookup", lookupOrders);
  router.post("/payments/payphone/confirm", confirmPayphonePayment);
  router.post("/admin/login", loginAdmin);
  router.get("/admin/orders", authMiddleware, listOrders);
  router.post("/admin/users", authMiddleware, createAdminUser);
}

export default routerApi;
