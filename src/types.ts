export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  price: number;
  deliveryTime?: string;
}
