const getProductEligibility = (product, store) => {
  if (!product) return false;
  const s = store || product.store;
  if (s) {
    if (s.tbOverride === "ENABLED") return true;
    if (s.tbOverride === "DISABLED") return false;
  }
  if (product.tbEligible !== null && product.tbEligible !== undefined) {
    return product.tbEligible;
  }
  return product.category === "Sneakers" || product.category === "Apparel";
};

function toRupees(dbPrice) {
  const p = Number(dbPrice) || 0;
  if (p === 0) return 0;
  if (p > 1000) return Math.round(p);
  return Math.round(p * 80);
}

const enrichOrderWithFees = (order, customerEmail) => {
  if (!order) return null;
  const isGold = !!(customerEmail?.toLowerCase() ?? "").includes("gold");
  const isTryAndBuy = !!order.deliveryAddr?.includes(" | Try & Buy");
  
  let deliveryFee = isGold ? 0 : 150;
  
  // Try & Buy fee: 0 for gold; 99 for standard if selected and has eligible items
  let tryAndBuyFee = 0;
  if (isTryAndBuy && !isGold) {
    const hasEligible = order.items?.some(
      (item) => getProductEligibility(item.product, item.product?.store)
    );
    if (hasEligible) {
      tryAndBuyFee = 99;
    }
  }

  const itemsTotal = order.items?.reduce((sum, item) => sum + toRupees(item.product?.price || 0) * item.quantity, 0) || 0;
  const finalTotal = itemsTotal + deliveryFee + tryAndBuyFee;
  
  // Clean up delivery address for display
  const displayAddress = order.deliveryAddr ? order.deliveryAddr.split(" | ")[0] : "";

  const tryTimerRemainingMs = order.tryTimerEnd 
    ? Math.max(0, new Date(order.tryTimerEnd).getTime() - Date.now()) 
    : 0;

  return {
    ...order,
    deliveryAddr: displayAddress,
    isGold,
    isTryAndBuy,
    deliveryFee,
    tryAndBuyFee,
    totalAmount: finalTotal,
    tryTimerRemainingMs
  };
};

module.exports = {
  getProductEligibility,
  enrichOrderWithFees
};
