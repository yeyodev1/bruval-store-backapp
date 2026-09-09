import axios from "axios";
import { createHash } from "node:crypto";
import type { Request } from "express";

/**
 * Meta Conversions API (server-side events).
 *
 * El Pixel del navegador y estos eventos comparten `event_id` para que Meta
 * los deduplique. El token vive solo en el servidor (META_CAPI_TOKEN).
 */
const GRAPH_VERSION = "v21.0";

export const META_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Lead",
  "Contact",
  "Search",
]);

export interface MetaUserData {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
  external_id?: string;
}

export interface MetaEvent {
  eventName: string;
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string;
  userData: MetaUserData;
  customData?: Record<string, unknown>;
}

function config() {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const token = process.env.META_CAPI_TOKEN?.trim();
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();
  return pixelId && token ? { pixelId, token, testEventCode } : null;
}

export function hashValue(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  return normalized ? createHash("sha256").update(normalized).digest("hex") : undefined;
}

export function hashPhone(value?: string | null) {
  const digits = (value || "").replace(/\D/g, "");
  return digits ? createHash("sha256").update(digits).digest("hex") : undefined;
}

export function clientInfo(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return {
    client_ip_address: (raw || req.socket?.remoteAddress || "").trim() || undefined,
    client_user_agent: req.headers["user-agent"] || undefined,
  };
}

/** Sanitiza los identificadores de cookie que envía el navegador. */
export function browserIds(input: { fbp?: unknown; fbc?: unknown }) {
  const fbp = typeof input.fbp === "string" && /^fb\.\d\.\d+\.\d+$/.test(input.fbp) ? input.fbp : undefined;
  const fbc = typeof input.fbc === "string" && /^fb\.\d\.\d+\.[\w-]+$/.test(input.fbc) ? input.fbc : undefined;
  return { fbp, fbc };
}

export async function sendMetaEvent(event: MetaEvent) {
  const settings = config();
  if (!settings) return;

  const userData = Object.fromEntries(Object.entries(event.userData).filter(([, value]) => Boolean(value)));
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_id: event.eventId,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        event_source_url: event.eventSourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: event.customData,
      },
    ],
  };
  if (settings.testEventCode) payload.test_event_code = settings.testEventCode;

  try {
    await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${settings.pixelId}/events`, payload, {
      params: { access_token: settings.token },
      timeout: 8000,
    });
  } catch (error: any) {
    console.error("Meta CAPI failed", event.eventName, error?.response?.data || error?.message);
  }
}
