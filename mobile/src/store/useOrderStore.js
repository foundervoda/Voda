import { create } from "zustand";

// Cart + active order — needs to persist across screens, no server sync (Handbook §12)
export const useOrderStore = create((set) => ({
  cart: [],
  activeOrder: null,

  addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),
  removeFromCart: (itemId) =>
    set((state) => ({ cart: state.cart.filter((i) => i.id !== itemId) })),
  clearCart: () => set({ cart: [] }),

  setActiveOrder: (order) => set({ activeOrder: order }),
}));
