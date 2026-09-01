import { CustomError } from "../errors/customError.error";

/** Envío gratis en todas las zonas: el cliente solo elige su sector para la ruta de entrega. */
export const DELIVERY_FEE = 0;

export const deliveryZones = [
  { name: "Zona Centro", fee: DELIVERY_FEE },
  { name: "Zona Norte", fee: DELIVERY_FEE },
  { name: "Zona Sur", fee: DELIVERY_FEE },
  { name: "Zona Sur Sector Puerto", fee: DELIVERY_FEE },
  { name: "Zona Durán Centro", fee: DELIVERY_FEE },
  { name: "Vía Durán Tambo", fee: DELIVERY_FEE },
  { name: "Vía Samborondón (hasta el Km 5)", fee: DELIVERY_FEE },
  { name: "Vía Samborondón (desde Km 5 hasta Estancia del Río)", fee: DELIVERY_FEE },
  { name: "Vía a Daule (hasta el Km 10)", fee: DELIVERY_FEE },
  { name: "Vía a Daule (desde Km 10 hasta Km 16)", fee: DELIVERY_FEE },
  { name: "Vía Daule (hasta Unilever)", fee: DELIVERY_FEE },
  { name: "Vía Salitre", fee: DELIVERY_FEE },
  { name: "Vía La Costa Chongón", fee: DELIVERY_FEE },
  { name: "La Aurora (La Joya, Villa Club, Villas del Rey)", fee: DELIVERY_FEE },
  { name: "Sector Centro Comercial El Dorado", fee: DELIVERY_FEE },
] as const;

export function deliveryFeeForZone(zone: unknown) {
  const deliveryZone = deliveryZones.find((entry) => entry.name === zone);
  if (!deliveryZone) throw new CustomError("Selecciona una zona de entrega válida", 400);
  return deliveryZone.fee;
}
