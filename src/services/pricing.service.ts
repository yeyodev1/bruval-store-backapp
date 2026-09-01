/**
 * Ajuste global de precio de venta al público.
 *
 * Los precios base viven en Mongo (los edita el admin). Este ajuste se aplica
 * en un solo lugar sobre el catálogo público y sobre el cobro del pedido, para
 * que la vitrina, el carrito y el cobro de Payphone siempre coincidan.
 *
 * Para volver a los precios base, dejar PRICE_ADJUSTMENT en 0.
 */
export const PRICE_ADJUSTMENT = 10;

export function retailPrice(price: number) {
  return Math.round((price + PRICE_ADJUSTMENT) * 100) / 100;
}

export function optionalRetailPrice(price?: number | null) {
  return typeof price === "number" && Number.isFinite(price) ? retailPrice(price) : undefined;
}
