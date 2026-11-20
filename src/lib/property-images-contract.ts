import { PAYMENT_ORIGINS, serviceBase } from "@/lib/payment-contract";

export const PROPERTY_IMAGES_PATH = "/api/public/property-images";

export function propertyImagesEndpoint(origin: string): string {
  if (!PAYMENT_ORIGINS.has(origin)) throw new Error("Property photos are not enabled for this website address.");
  return `${serviceBase(origin)}${PROPERTY_IMAGES_PATH}`;
}