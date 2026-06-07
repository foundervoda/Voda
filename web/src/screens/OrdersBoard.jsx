import { useEffect, useState } from "react";
import { socket } from "../api/socket";

// Real-time incoming orders board (Handbook §06)
export default function OrdersBoard({ storeId }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    socket.emit("join_store_room", storeId);

    const handleNewOrder = (order) => setOrders((prev) => [order, ...prev]);
    const handleRunnerArrived = ({ orderId }) =>
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "RUNNER_HERE" } : o))
      );

    socket.on("new_order", handleNewOrder);
    socket.on("runner_arrived", handleRunnerArrived);

    return () => {
      socket.off("new_order", handleNewOrder);
      socket.off("runner_arrived", handleRunnerArrived);
    };
  }, [storeId]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Incoming orders</h1>

      {orders.length === 0 ? (
        <p className="text-gray-500">Waiting for new orders…</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id} className="border rounded-lg p-4 flex justify-between">
              <span>Order #{order.id}</span>
              <span className="text-sm text-gray-500">{order.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
