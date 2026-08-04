import { CustomError } from "../errors/customError.error";

export const deliveryZones = [
  { name: "Zona Centro", fee: 8 },
  { name: "Zona Norte", fee: 8 },
  { name: "Zona Sur", fee: 10 },
  { name: "Zona Sur Sector Puerto", fee: 13 },
  { name: "Zona Durán Centro", fee: 10 },
  { name: "Vía Durán Tambo", fee: 12 },
  { name: "Vía Samborondón (hasta el Km 5)", fee: 10 },
  { name: "Vía Samborondón (desde Km 5 hasta Estancia del Río)", fee: 12 },
  { name: "Vía a Daule (hasta el Km 10)", fee: 10 },
  { name: "Vía a Daule (desde Km 10 hasta Km 16)", fee: 13 },
  { name: "Vía Daule (hasta Unilever)", fee: 18 },
  { name: "Vía Salitre", fee: 13 },
  { name: "Vía La Costa Chongón", fee: 18 },
  { name: "La Aurora (La Joya, Villa Club, Villas del Rey)", fee: 12 },
  { name: "Sector Centro Comercial El Dorado", fee: 13 },
] as const;

export function deliveryFeeForZone(zone: unknown) {
  const deliveryZone = deliveryZones.find((entry) => entry.name === zone);
  if (!deliveryZone) throw new CustomError("Selecciona una zona de entrega válida", 400);
  return deliveryZone.fee;
}
