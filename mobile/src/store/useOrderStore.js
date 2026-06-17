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
  placeOrder: async (deliveryAddr, isGoldSubscriber, isTryAndBuy) => {
    const { cart } = get();
    const items = cart.map(({ productId, variantId, quantity }) => ({
      productId,
      variantId,
      quantity,
    }));

    let finalAddr = deliveryAddr;
    if (isTryAndBuy) {
      finalAddr = `${deliveryAddr} | Try & Buy`;
    }

    const { data } = await api.post("/orders", { 
      deliveryAddr: finalAddr, 
      etaMinutes: 30, 
      items,
      isGoldSubscriber,
      isTryAndBuy
    });
    const order = data.data.order;
    set({ activeOrder: order, cart: [] });
    return order;
  },
}));
