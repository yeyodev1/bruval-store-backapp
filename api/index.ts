import "dotenv/config";
import { createApp } from "../src/app";
import { dbConnect } from "../src/config/mongo";

let initialized = false;

async function ensureDb() {
  if (initialized) return;
  await dbConnect();
  initialized = true;
}

const { app } = createApp();

export default async function handler(req: any, res: any) {
  await ensureDb();
  await new Promise<void>((resolve, reject) => {
    res.once("finish", resolve);
    res.once("error", reject);
    app(req, res);
  });
}
