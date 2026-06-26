import { create } from "zustand";

export const useSizingStore = create((set) => ({
  sizeSneakers: "",
  sizeApparel: "",
  fitApparel: "",
  setSizes: (sizes) => set((state) => ({ ...state, ...sizes })),
}));
