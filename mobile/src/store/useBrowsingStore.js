import { create } from "zustand";

export const useBrowsingStore = create((set) => ({
  recentCategories: [],
  addBrowsedCategory: (category) => {
    if (!category) return;
    set((state) => {
      const filtered = state.recentCategories.filter((c) => c !== category);
      return { recentCategories: [category, ...filtered].slice(0, 5) };
    });
  },
}));
