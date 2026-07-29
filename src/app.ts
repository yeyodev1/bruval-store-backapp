import express from "express";
import cors from "cors";
import http from "http";
import routerApi from "./routes";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.middleware";

const whitelist = [
  "http://localhost:8100",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8101",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://testing-storybrand-frontend.bakano.ec",
];

function isAllowedOrigin(origin: string) {
  if (whitelist.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (url.hostname === "bakano.ec" || url.hostname.endsWith(".bakano.ec"));
  } catch {
    return false;
  }
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

export function createApp() {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json({ limit: "50mb" }));

  app.get("/", (_req, res) => {
    res.send("Server is alive");
  });

  routerApi(app);

  app.use(globalErrorHandler);

  const server = http.createServer(app);

  return { app, server };
}
