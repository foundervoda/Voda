import { create } from "zustand";
import { api } from "../api/client";

export const useOrderStore = create((set, get) => ({
  cart: [],
  activeOrder: null,

  // Add item or increment quantity if variant already in cart
  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((i) => i.variantId === item.variantId);
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.variantId === item.variantId ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { cart: [...state.cart, { ...item, quantity: 1 }] };
    }),

  removeFromCart: (variantId) =>
    set((state) => ({ cart: state.cart.filter((i) => i.variantId !== variantId) })),

  updateQuantity: (variantId, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((i) => i.variantId !== variantId)
          : state.cart.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
    })),

  clearCart: () => set({ cart: [] }),

  setActiveOrder: (order) => set({ activeOrder: order }),

  // Places the order against the live API, clears the cart on success
  placeOrder: async (deliveryAddr) => {
    const { cart } = get();
    const items = cart.map(({ productId, variantId, quantity }) => ({
      productId,
      variantId,
      quantity,
    }));
    const { data } = await api.post("/orders", { deliveryAddr, etaMinutes: 30, items });
    const order = data.data.order;
    set({ activeOrder: order, cart: [] });
    return order;
  },
}));
