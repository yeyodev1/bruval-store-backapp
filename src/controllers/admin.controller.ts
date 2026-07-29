import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextFunction, Response } from "express";
import { CustomError } from "../errors/customError.error";
import { AdminUser } from "../models/adminUser.model";
import { Order } from "../models/order.model";
import { AuthRequest } from "../types/AuthRequest";

async function ensureInitialAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new CustomError("La cuenta administrativa no está configurada", 503);
  if (await AdminUser.exists({ email })) return;
  await AdminUser.create({ name: "Diego Reyes", email, passwordHash: await bcrypt.hash(password, 12), role: "admin" });
}

function requireAdmin(req: AuthRequest) {
  if (req.user?.accountType !== "admin") throw new CustomError("No tienes permisos administrativos", 403);
}

export async function loginAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await ensureInitialAdmin();
    const { email, password } = req.body;
    const user = await AdminUser.findOne({ email: String(email || "").toLowerCase() });
    if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new CustomError("Correo o contraseña incorrectos", 401);
    }
    const token = jwt.sign({ userId: user._id.toString(), email: user.email, accountType: "admin" }, process.env.JWT_SECRET as string, { expiresIn: "12h" });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
}

export async function listOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    requireAdmin(req);
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (error) {
    next(error);
  }
}

export async function createAdminUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    requireAdmin(req);
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || password.length < 8) throw new CustomError("Nombre, correo y contraseña de mínimo 8 caracteres son obligatorios", 400);
    if (await AdminUser.exists({ email: String(email).toLowerCase() })) throw new CustomError("Este correo ya tiene acceso", 409);
    const user = await AdminUser.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: role === "admin" ? "admin" : "advisor" });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    next(error);
  }
}
