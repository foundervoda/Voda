import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const getProductImage = (item) => {
  const basePath = "http://localhost:3001";
  const imgPath = item?.images?.[0] || item?.imageUrl || item?.image;
  if (!imgPath) return null;
  return imgPath.startsWith("http") ? { uri: imgPath } : { uri: `${basePath}${imgPath}` };
};
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/useAuthStore";
import { api } from "../../api/client";
import { useBrowsingStore } from "../../store/useBrowsingStore";
import { useSizingStore } from "../../store/useSizingStore";

// Chat State Machine steps
const STEPS = {
  GREETING: "GREETING",
  SUPPORT_MENU: "SUPPORT_MENU",
  TRACK_ORDER: "TRACK_ORDER",
  RETURN_ITEM_SELECT: "RETURN_ITEM_SELECT",
  RETURN_REASON_SELECT: "RETURN_REASON_SELECT",
  RETURN_CONFIRM_ADDR: "RETURN_CONFIRM_ADDR",
  RETURN_POLICY_INFO: "RETURN_POLICY_INFO",
  PAYMENT_DESCRIBE: "PAYMENT_DESCRIBE",
  PAYMENT_DECIDE: "PAYMENT_DECIDE",
  OTHER_DESCRIBE: "OTHER_DESCRIBE",
  OTHER_RESOLVING: "OTHER_RESOLVING",
  ESCALATED: "ESCALATED",
  ANYTHING_ELSE: "ANYTHING_ELSE",
  SIZING_CATEGORY: "SIZING_CATEGORY",
  SIZING_SHOES_INPUT: "SIZING_SHOES_INPUT",
  SIZING_APPAREL_FIT: "SIZING_APPAREL_FIT",
  SIZING_APPAREL_SIZE: "SIZING_APPAREL_SIZE",
  SIZING_RESULT: "SIZING_RESULT",
  RECOMMEND_PROMPT: "RECOMMEND_PROMPT",
  RECOMMEND_RESOLVE: "RECOMMEND_RESOLVE"
};

const requestWithTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), ms))
  ]);
};

export default function ChatbotScreen({ navigation, onClose }) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef();
  
  const { user } = useAuthStore();
  const userName = user?.email ? user.email.split("@")[0] : "Customer";
  const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // States
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState(STEPS.GREETING);
  const [orders, setOrders] = useState([]);
  const [failCounter, setFailCounter] = useState(0);

  // Chat Context for storing inputs
  const [chatContext, setChatContext] = useState({
    selectedOrder: null,
    selectedItem: null,
    returnReason: "",
    address: "Level 1 Guest Lounge, Voda Mall",
    paymentDescription: "",
    otherDescription: "",
    sizingCategory: "",
    sizingInput: "",
    sizingFit: ""
  });

  // Fetch orders on load
  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await api.get("/orders");
        const allOrders = res.data?.data?.orders || res.data?.orders || [];
        const mine = allOrders.filter(o => o.customerId === user?.id);
        setOrders(mine);
      } catch (err) {
        console.error("Error fetching customer orders in chatbot:", err);
      }
    }
    if (user?.id) {
      fetchOrders();
    }
  }, [user]);

  // Initial Greeting with WhatsApp Options
  useEffect(() => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initialOptions = [
      { label: "Customer Support", action: () => transitionTo(STEPS.SUPPORT_MENU) },
      { label: "Size Calculator", action: () => transitionTo(STEPS.SIZING_CATEGORY) },
      { label: "Personalized Recommendations", action: () => transitionTo(STEPS.RECOMMEND_PROMPT) },
      { label: "Free Text Chat", action: () => startFreeText() }
    ];
    
    setMessages([
      {
        id: "greet-1",
        text: `Hi ${capitalizedName}! What do you need help with today?`,
        sender: "bot",
        time,
        options: initialOptions,
        isAnswered: false
      }
    ]);
  }, []);

  const addBotMessage = (text, options = null, customComponent = null) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        text,
        sender: "bot",
        time,
        options,
        isAnswered: false,
        customComponent
      }
    ]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const addUserMessage = (text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        text,
        sender: "user",
        time,
      }
    ]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleOptionPress = (messageId, option) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isAnswered: true } : m))
    );
    addUserMessage(option.label);
    option.action();
  };

  // State Transition Machine
  const transitionTo = (nextStep, customContext = {}) => {
    setCurrentStep(nextStep);
    setChatContext(prev => {
      const newCtx = { ...prev, ...customContext };
      
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        
        switch (nextStep) {
          case STEPS.SUPPORT_MENU:
            addBotMessage("What do you need help with in Support?", [
              { label: "Track Order", action: () => transitionTo(STEPS.TRACK_ORDER) },
              { label: "Return/Refund beyond 10 min", action: () => transitionTo(STEPS.RETURN_ITEM_SELECT) },
              { label: "Payment Issue", action: () => transitionTo(STEPS.PAYMENT_DESCRIBE) },
              { label: "Wrong Item", action: () => transitionTo(STEPS.OTHER_DESCRIBE) },
              { label: "Something Else", action: () => transitionTo(STEPS.OTHER_DESCRIBE) }
            ]);
            break;

          case STEPS.TRACK_ORDER:
            if (orders.length === 0) {
              addBotMessage("I couldn't find any recent orders associated with your account.");
              transitionTo(STEPS.ANYTHING_ELSE);
            } else {
              const latest = orders[0];
              addBotMessage("Here is the live status of your latest order:", null, renderOrderStatusCard(latest));
              setTimeout(() => {
                addBotMessage(`Your order is currently ${latest.status}. Live ETA is ~${latest.etaMinutes} minutes.`);
                transitionTo(STEPS.ANYTHING_ELSE);
              }, 600);
            }
            break;

          case STEPS.RETURN_ITEM_SELECT:
            if (orders.length === 0) {
              addBotMessage("You have no past orders on file to initiate a return request.");
              transitionTo(STEPS.ANYTHING_ELSE);
            } else {
              const returnableItems = [];
              orders.forEach(o => {
                o.items.forEach(i => {
                  returnableItems.push({
                    orderId: o.id,
                    itemId: i.id,
                    name: i.product?.name || "Product",
                    category: i.product?.category || "Sneakers",
                    size: i.variant?.size || "Standard",
                    qty: i.quantity
                  });
                });
              });

              if (returnableItems.length === 0) {
                addBotMessage("You have no items eligible for return.");
                transitionTo(STEPS.ANYTHING_ELSE);
              } else {
                addBotMessage(
                  "Which item would you like to return?",
                  returnableItems.slice(0, 5).map(item => ({
                    label: `${item.name} (Size: ${item.size})`,
                    action: () => transitionTo(STEPS.RETURN_REASON_SELECT, { selectedItem: item })
                  }))
                );
              }
            }
            break;

          case STEPS.RETURN_REASON_SELECT:
            addBotMessage("Please select the reason for your return:", [
              { label: "Wrong Size", action: () => transitionTo(STEPS.RETURN_CONFIRM_ADDR, { returnReason: "Wrong Size" }) },
              { label: "Damaged / Defective", action: () => transitionTo(STEPS.RETURN_CONFIRM_ADDR, { returnReason: "Damaged / Defective" }) },
              { label: "Changed Mind", action: () => transitionTo(STEPS.RETURN_CONFIRM_ADDR, { returnReason: "Changed Mind" }) },
              { label: "Other", action: () => transitionTo(STEPS.RETURN_CONFIRM_ADDR, { returnReason: "Other" }) }
            ]);
            break;

          case STEPS.RETURN_CONFIRM_ADDR:
            addBotMessage(`Please confirm your return pickup address:\n"${newCtx.address || 'Mall lobby'}"`, [
              { label: "Confirm Address", action: () => transitionTo(STEPS.RETURN_POLICY_INFO) },
              { label: "Enter New Address", action: () => {
                addBotMessage("Please type and send your new pickup address:");
              }}
            ]);
            break;

          case STEPS.RETURN_POLICY_INFO:
            addBotMessage("Return Filed! A Voda runner will pick up the package within 24 hours. Refunds are processed immediately to your original payment method upon pickup validation.");
            transitionTo(STEPS.ANYTHING_ELSE);
            break;

          case STEPS.PAYMENT_DESCRIBE:
            addBotMessage("Please describe the payment issue you encountered (e.g. duplicate charge, failed transaction):");
            break;

          case STEPS.PAYMENT_DECIDE:
            const isAuto = newCtx.paymentDescription.toLowerCase().includes("duplicate");
            if (isAuto) {
              addBotMessage("Payment scan completed: Duplicate charge detected. We have automatically reversed the transaction of ₹7,199.00. Refunds take 3-5 business days to credit.");
              transitionTo(STEPS.ANYTHING_ELSE);
            } else {
              addBotMessage("Unable to auto-resolve payment inquiry. Escalating to billing agent...");
              transitionTo(STEPS.ESCALATED);
            }
            break;

          case STEPS.OTHER_DESCRIBE:
            addBotMessage("Please describe the issue or wrong item details:");
            break;

          case STEPS.OTHER_RESOLVING:
            if (failCounter >= 1) {
              addBotMessage("I am unable to resolve this issue automatically. Initiating human agent hand-off...");
              transitionTo(STEPS.ESCALATED);
            } else {
              setFailCounter(prev => prev + 1);
              addBotMessage("I've checked our packing log: items were scanned correct. Did you receive a different color, or is a size mislabeled?", [
                { label: "Different Color", action: () => transitionTo(STEPS.ESCALATED) },
                { label: "Mislabeled Size", action: () => transitionTo(STEPS.ESCALATED) },
                { label: "Something Else", action: () => transitionTo(STEPS.ESCALATED) }
              ]);
            }
            break;

          case STEPS.ESCALATED:
            addBotMessage("Support Ticket Raised. Connecting you to a live support agent...");
            setTimeout(() => {
              addBotMessage("Connected to Support Agent (Human Handoff).\nAverage response time: 3 mins.\n\nStatus: Resolved by human agent.", [
                { label: "Start New Query", action: () => resetToMenu() }
              ]);
            }, 1200);
            break;

          case STEPS.ANYTHING_ELSE:
            addBotMessage("Is there anything else I can help you with?", [
              { label: "Back to Main Menu", action: () => resetToMenu() },
              { label: "No, finish", action: async () => {
                setIsTyping(true);
                try {
                  const recs = await fetchStripRecommendations();
                  setIsTyping(false);
                  addBotMessage(
                    "Thank you for shopping with Voda! Have a wonderful day in the mall.",
                    [
                      { label: "Start New Query", action: () => resetToMenu() }
                    ],
                    renderRecommendationStrip(recs)
                  );
                } catch (err) {
                  setIsTyping(false);
                  addBotMessage(
                    "Thank you for shopping with Voda! Have a wonderful day in the mall.",
                    [
                      { label: "Start New Query", action: () => resetToMenu() }
                    ]
                  );
                }
              }}
            ]);
            break;

          // Sizing Calculator Branch
          case STEPS.SIZING_CATEGORY:
            addBotMessage("Select the product category for sizing calculation:", [
              { label: "Sneakers / Shoes", action: () => transitionTo(STEPS.SIZING_SHOES_INPUT, { sizingCategory: "Sneakers" }) },
              { label: "Apparel / Clothing", action: () => transitionTo(STEPS.SIZING_APPAREL_FIT, { sizingCategory: "Apparel" }) }
            ]);
            break;

          case STEPS.SIZING_SHOES_INPUT:
            addBotMessage("What size do you usually wear in US/UK?", [
              { label: "US 7 / UK 6", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: 6 }) },
              { label: "US 8 / UK 7", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: 7 }) },
              { label: "US 9 / UK 8", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: 8 }) },
              { label: "US 10 / UK 9", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: 9 }) },
              { label: "US 11 / UK 10", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: 10 }) }
            ]);
            break;

          case STEPS.SIZING_APPAREL_FIT:
            addBotMessage("What is your typical fit preference?", [
              { label: "Slim Fit", action: () => transitionTo(STEPS.SIZING_APPAREL_SIZE, { sizingFit: "Slim Fit" }) },
              { label: "Regular Fit", action: () => transitionTo(STEPS.SIZING_APPAREL_SIZE, { sizingFit: "Regular Fit" }) },
              { label: "Oversized Fit", action: () => transitionTo(STEPS.SIZING_APPAREL_SIZE, { sizingFit: "Oversized" }) }
            ]);
            break;

          case STEPS.SIZING_APPAREL_SIZE:
            addBotMessage("Select your standard chest size or build:", [
              { label: "Small (< 38 in)", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: "S" }) },
              { label: "Medium (38-40 in)", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: "M" }) },
              { label: "Large (40-42 in)", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: "L" }) },
              { label: "X-Large (42+ in)", action: () => transitionTo(STEPS.SIZING_RESULT, { sizingInput: "XL" }) }
            ]);
            break;

          case STEPS.SIZING_RESULT:
            const { sizingCategory, sizingInput, sizingFit } = newCtx;
            if (sizingCategory === "Sneakers") {
              const recSize = `UK ${sizingInput}`;
              useSizingStore.getState().setSizes({ sizeSneakers: recSize });
              addBotMessage(
                `Based on our Sneaker House catalog, we recommend ordering size UK ${sizingInput} for standard fit. For wider feet, consider a half-size up.`,
                null,
                renderSizingCard("Sneakers", `UK ${sizingInput}`, "Standard Fit")
              );
            } else {
              useSizingStore.getState().setSizes({ sizeApparel: sizingInput, fitApparel: sizingFit });
              addBotMessage(
                `We recommend size ${sizingInput} for a perfect ${sizingFit} look in our Zara Luxe and Stellar catalogs!`,
                null,
                renderSizingCard("Apparel", sizingInput, sizingFit)
              );
            }
            transitionTo(STEPS.ANYTHING_ELSE);
            break;

          // AI Recommendations (Option B)
          case STEPS.RECOMMEND_PROMPT:
            addBotMessage("Describe what style, look, or product you are looking for today (e.g. 'warm coat' or 'running shoes'):");
            break;

          case STEPS.RECOMMEND_RESOLVE:
            // This is triggered in handleSendText asynchronously
            break;
        }
      }, 600);

      return newCtx;
    });
  };

  const startFreeText = () => {
    addBotMessage("Free Text enabled! Send me any questions about mall hours, directions, or catalog items.", [
      { label: "Back to Menu", action: () => resetToMenu() }
    ]);
    setCurrentStep("FREE_TEXT");
  };

  const fetchStripRecommendations = async () => {
    try {
      let category = null;
      if (chatContext.selectedItem?.category) {
        category = chatContext.selectedItem.category;
      }
      
      // If not a return query, fall back to recent browsing history categories
      if (!category) {
        const recentCats = useBrowsingStore.getState().recentCategories || [];
        if (recentCats.length > 0) {
          category = recentCats[0];
        }
      }

      const res = await requestWithTimeout(
        api.get("/products", { params: category ? { category } : {} }),
        3000
      );
      const data = res.data;
      let list = data?.data?.products || [];
      
      // Clean and compare sizes flexibly (e.g. "UK 8" matches variant size "8")
      const cleanSize = (sz) => String(sz).toLowerCase().replace(/^(uk|us)\s*/i, "").trim();

      const savedSizes = useSizingStore.getState();
      const finalSizingInput = chatContext.sizingInput || (category === "Sneakers" ? savedSizes.sizeSneakers : savedSizes.sizeApparel);

      if (finalSizingInput) {
        const targetSize = cleanSize(finalSizingInput);
        const filteredList = list.filter((p) =>
          p.variants?.some((v) => cleanSize(v.size) === targetSize)
        );
        if (filteredList.length > 0) {
          list = filteredList;
        }
      }

      return list.slice(0, 4);
    } catch (err) {
      console.log("Failed to fetch strip recommendations:", err);
      return [];
    }
  };

  const renderRecommendationStrip = (items) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={s.stripContainer}>
        <Text style={s.stripTitle}>You might also like: ✨</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stripScroll}>
          {items.map((prod) => {
            const roundedPrice = Math.round(Number(prod.price) || 0);
            const formattedPrice = roundedPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const imageSource = getProductImage(prod);
            
            return (
              <Pressable
                key={prod.id}
                style={s.stripCard}
                onPress={() => {
                  if (onClose) onClose();
                  if (navigation) {
                    setTimeout(() => {
                      navigation.navigate("ProductDetail", { productId: prod.id, id: prod.id });
                    }, 300);
                  }
                }}
              >
                <View style={s.stripImageWrapper}>
                  {imageSource ? (
                    <Image source={imageSource} style={s.stripImage} resizeMode="cover" />
                  ) : (
                    <View style={s.stripFallbackBg}>
                      <Ionicons name="image-outline" size={16} color="#012a62" style={{ opacity: 0.3 }} />
                    </View>
                  )}
                </View>
                <Text style={s.stripProdName} numberOfLines={1}>{prod.name}</Text>
                <Text style={s.stripStoreName} numberOfLines={1}>{prod.store?.name || "Outlet"}</Text>
                <Text style={s.stripPrice}>₹{formattedPrice}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const resetToMenu = () => {
    setCurrentStep(STEPS.GREETING);
    setFailCounter(0);
    addBotMessage(`What do you need help with?`, [
      { label: "Customer Support", action: () => transitionTo(STEPS.SUPPORT_MENU) },
      { label: "Size Calculator", action: () => transitionTo(STEPS.SIZING_CATEGORY) },
      { label: "Personalized Recommendations", action: () => transitionTo(STEPS.RECOMMEND_PROMPT) },
      { label: "Free Text Chat", action: () => startFreeText() }
    ]);
  };

  // Keyboard text submit
  const handleSendText = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    addUserMessage(text);
    setInputText("");

    setIsTyping(true);
    setTimeout(async () => {
      setIsTyping(false);

      if (currentStep === STEPS.RETURN_CONFIRM_ADDR) {
        transitionTo(STEPS.RETURN_POLICY_INFO, { address: text });
      } else if (currentStep === STEPS.PAYMENT_DESCRIBE) {
        transitionTo(STEPS.PAYMENT_DECIDE, { paymentDescription: text });
      } else if (currentStep === STEPS.OTHER_DESCRIBE) {
        transitionTo(STEPS.OTHER_RESOLVING, { otherDescription: text });
      } else if (currentStep === STEPS.RECOMMEND_PROMPT) {
        setIsTyping(true);
        try {
          const res = await requestWithTimeout(
            api.post("/products/recommend", { query: text }),
            4000
          );
          const items = res.data?.data?.products || [];
          setIsTyping(false);
          
          if (items.length === 0) {
            addBotMessage("I couldn't find any recommendations matching that description in our directory catalog.");
          } else {
            addBotMessage("Here are your Personalized Recommendations from the Voda outlets directory:");
            items.forEach(prod => {
              addBotMessage(`${prod.name}`, null, renderRecommendCard(prod));
            });
          }
        } catch (err) {
          console.error("Error fetching AI recommendations:", err);
          setIsTyping(false);
          addBotMessage("Sorry, I encountered an issue querying the recommendation service.");
        } finally {
          transitionTo(STEPS.ANYTHING_ELSE);
        }
      } else {
        const lower = text.toLowerCase();
        const isClosingMsg = 
          lower === "no" || 
          lower === "no thanks" || 
          lower === "no, thanks" || 
          lower === "no thank you" || 
          lower === "no, thank you" || 
          lower.includes("bye") || 
          lower.includes("goodbye") || 
          lower.includes("thank you") || 
          lower === "thanks" || 
          lower === "exit" || 
          lower === "finish";

        if (lower.includes("menu") || lower.includes("start over") || lower.includes("help") || lower.includes("restart") || lower.includes("reset") || lower.includes("start")) {
          resetToMenu();
        } else if (isClosingMsg) {
          setIsTyping(true);
          try {
            const recs = await fetchStripRecommendations();
            setIsTyping(false);
            addBotMessage(
              "Thank you for shopping with Voda! Have a wonderful day in the mall.",
              [
                { label: "Start New Query", action: () => resetToMenu() }
              ],
              renderRecommendationStrip(recs)
            );
          } catch (err) {
            setIsTyping(false);
            addBotMessage(
              "Thank you for shopping with Voda! Have a wonderful day in the mall.",
              [
                { label: "Start New Query", action: () => resetToMenu() }
              ]
            );
          }
        } else {
          // Treat general doubts/questions as semantic search (Option B)!
          setIsTyping(true);
          try {
            const res = await requestWithTimeout(
              api.post("/products/recommend", { query: text }),
              4000
            );
            const items = res.data?.data?.products || [];
            setIsTyping(false);
            
            if (items.length > 0) {
              addBotMessage(`Here are your Personalized Recommendations for "${text}":`);
              items.forEach(prod => {
                addBotMessage(`${prod.name}`, null, renderRecommendCard(prod));
              });
              transitionTo(STEPS.ANYTHING_ELSE);
            } else {
              addBotMessage(`I couldn't find any direct matches for "${text}". What would you like to do?`, [
                { label: "Return to Main Menu", action: () => resetToMenu() },
                { label: "Keep Chatting (Free Text)", action: () => startFreeText() }
              ]);
            }
          } catch (err) {
            console.error("Error fetching AI recommendations:", err);
            setIsTyping(false);
            addBotMessage("Sorry, I encountered an issue querying the recommendation service.");
            transitionTo(STEPS.ANYTHING_ELSE);
          }
        }
      }
    }, 800);
  };

  // Custom Order Status Card Bubble
  const renderOrderStatusCard = (order) => {
    const formattedId = order.id.slice(0, 8).toUpperCase();
    return (
      <View style={s.orderCard}>
        <View style={s.orderHeader}>
          <Text style={s.orderIdText}>Order #{formattedId}</Text>
          <View style={s.statusBadge}>
            <Text style={s.statusText}>{order.status}</Text>
          </View>
        </View>
        <View style={s.divider} />
        <View style={s.orderBody}>
          {order.items.map((item, idx) => (
            <Text key={idx} style={s.itemText}>
              • {item.product?.name || "Item"} {item.variant?.size ? `(Size ${item.variant.size})` : ""} x{item.quantity}
            </Text>
          ))}
        </View>
        <View style={s.divider} />
        <View style={s.orderFooter}>
          <Text style={s.etaText}>🕒 ETA: ~{order.etaMinutes} mins</Text>
          <Text style={s.addrText} numberOfLines={1}>📍 {order.deliveryAddr}</Text>
        </View>
      </View>
    );
  };

  // Custom Sizing Result Card
  const renderSizingCard = (category, resultSize, fit) => {
    return (
      <View style={s.sizingCard}>
        <View style={s.sizingHeader}>
          <Ionicons name={category === "Sneakers" ? "footsteps" : "shirt"} size={18} color="#012a62" />
          <Text style={s.sizingHeaderTitle}>{category} Size Recommendation</Text>
        </View>
        <View style={s.sizingDivider} />
        <View style={s.sizingBody}>
          <Text style={s.sizingLabel}>RECOMMENDED SIZE</Text>
          <Text style={s.sizingValue}>{resultSize}</Text>
          {fit ? <Text style={s.sizingFitText}>Fit style: {fit}</Text> : null}
        </View>
        <View style={s.sizingDivider} />
        <Text style={s.sizingFooterText}>Calculated dynamically from Voda catalogs</Text>
      </View>
    );
  };

  // Custom Product Recommendation Card Bubble (Option B details view)
  const renderRecommendCard = (prod) => {
    const roundedPrice = Math.round(Number(prod.price) || 0);
    const formattedPrice = roundedPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const imageSource = getProductImage(prod);
    return (
      <View style={s.recommendCard}>
        <View style={s.recommendImageWrapper}>
          {imageSource ? (
            <Image source={imageSource} style={s.recommendImage} resizeMode="cover" />
          ) : (
            <View style={s.recommendFallbackBg}>
              <Ionicons name="image-outline" size={20} color="#012a62" style={{ opacity: 0.3 }} />
            </View>
          )}
        </View>
        <Text style={s.recommendName} numberOfLines={1}>{prod.name}</Text>
        <Text style={s.recommendStore}>{prod.store?.name || "Outlet"} ({prod.store?.location || ""})</Text>
        <Text style={s.recommendPrice}>₹{formattedPrice}</Text>
        <Pressable
          onPress={() => {
            if (onClose) onClose();
            if (navigation) {
              setTimeout(() => {
                navigation.navigate("ProductDetail", { productId: prod.id });
              }, 300);
            }
          }}
          style={({ pressed }) => [
            s.recommendBtn,
            pressed && { opacity: 0.8 }
          ]}
        >
          <Text style={s.recommendBtnText}>View Product Details</Text>
        </Pressable>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const isBot = item.sender === "bot";
    return (
      <View style={{ marginBottom: 12 }}>
        <View style={[s.messageWrapper, isBot ? s.wrapperBot : s.wrapperUser, { marginBottom: 0 }]}>
          {isBot && (
            <View style={s.botAvatar}>
              <Ionicons name="chatbubbles" size={14} color="#fdde59" />
            </View>
          )}
          <View style={[s.messageBubble, isBot ? s.bubbleBot : s.bubbleUser]}>
            <View style={s.textContainer}>
              <Text style={[s.messageText, isBot ? s.textBot : s.textUser]}>{item.text}</Text>
              <Text style={[s.timeText, isBot ? s.timeBot : s.timeUser]}>{item.time}</Text>
            </View>

            {isBot && item.options && !item.isAnswered && (
              <View style={s.optionsWrapper}>
                {item.options.map((opt, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => handleOptionPress(item.id, opt)}
                    style={({ pressed }) => [
                      s.whatsappOptionBtn,
                      pressed && { backgroundColor: "#f1f5f9" }
                    ]}
                  >
                    <Text style={s.whatsappOptionText}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        {isBot && item.customComponent && (
          <View style={{ marginLeft: 36, marginTop: 4 }}>
            {item.customComponent}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.root}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === "ios" ? 36 : Math.max(insets.top, 14) }]}>
        {Platform.OS === "ios" && (
          <View style={s.grabHandle} />
        )}
        <View style={s.headerRow}>
          <View style={s.headerInfo}>
            <View style={s.avatarStatusContainer}>
              <View style={s.headerAvatar}>
                <Ionicons name="chatbubbles" size={20} color="#fdde59" />
              </View>
              <View style={s.statusIndicator} />
            </View>
            <View>
              <Text style={s.headerTitle}>VodaBot Help</Text>
              <Text style={s.headerSubtitle}>Voda Mall Support Assistant • Online</Text>
            </View>
          </View>
          {onClose && (
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close-circle" size={28} color="#012a62" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        ListFooterComponent={
          isTyping ? (
            <View style={[s.messageWrapper, s.wrapperBot]}>
              <View style={s.botAvatar}>
                <Ionicons name="chatbubbles" size={14} color="#fdde59" />
              </View>
              <View style={[s.messageBubble, s.bubbleBot, s.typingBubble]}>
                <View style={s.textContainer}>
                  <Text style={[s.messageText, s.textBot, s.typingText]}>Typing...</Text>
                </View>
              </View>
            </View>
          ) : null
        }
      />

      {/* TextInput footer */}
      <View style={[s.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.inputWrapper}>
          <TextInput
            style={s.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type message here..."
            placeholderTextColor="#012a6240"
            onSubmitEditing={handleSendText}
          />
          <Pressable style={s.sendBtn} onPress={handleSendText}>
            <Ionicons name="send" size={18} color="#fdde59" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fdf9ea",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60, 60, 67, 0.29)",
    backgroundColor: "#ffffff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  grabHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#d1d1d6",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  sizingCard: {
    backgroundColor: "#fffef5",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#012a6215",
    padding: 12,
    marginTop: 8,
    width: 220,
  },
  sizingHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sizingHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#012a62",
    marginLeft: 6,
  },
  sizingDivider: {
    height: 1,
    backgroundColor: "#012a6210",
    marginVertical: 8,
  },
  sizingBody: {
    alignItems: "center",
    paddingVertical: 4,
  },
  sizingLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#012a6260",
    letterSpacing: 0.5,
  },
  sizingValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#012a62",
    marginVertical: 4,
  },
  sizingFitText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#012a6280",
  },
  sizingFooterText: {
    fontSize: 8.5,
    color: "rgba(1, 42, 98, 0.4)",
    fontWeight: "600",
    textAlign: "center",
  },
  recommendCard: {
    backgroundColor: "#fffef5",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#012a6215",
    padding: 12,
    marginTop: 8,
    width: 220,
  },
  recommendImageWrapper: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(1, 42, 98, 0.02)",
    marginBottom: 8,
  },
  recommendImage: {
    width: "100%",
    height: "100%",
  },
  recommendFallbackBg: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  recommendName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#012a62",
    marginBottom: 4,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarStatusContainer: {
    position: "relative",
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(60, 60, 67, 0.5)",
    fontWeight: "400",
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-end",
  },
  wrapperBot: {
    justifyContent: "flex-start",
  },
  wrapperUser: {
    justifyContent: "flex-end",
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    overflow: "hidden", // Crucial so options don't clip rounded corners
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: "rgba(1, 42, 98, 0.05)",
  },
  bubbleBot: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: "#012a62",
    borderBottomRightRadius: 4,
  },
  textContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  typingBubble: {
    borderRadius: 18,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  textBot: {
    color: "#012a62",
  },
  textUser: {
    color: "#ffffff",
    fontWeight: "600",
  },
  typingText: {
    color: "rgba(1, 42, 98, 0.4)",
    fontStyle: "italic",
  },
  timeText: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: "flex-end",
    fontWeight: "500",
  },
  timeBot: {
    color: "rgba(1, 42, 98, 0.3)",
  },
  timeUser: {
    color: "rgba(255, 255, 255, 0.6)",
  },
  optionsWrapper: {
    width: "100%",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  whatsappOptionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#012a62",
    marginBottom: 8,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1.5,
    width: "100%",
  },
  whatsappOptionText: {
    fontSize: 14.5,
    color: "#012a62",
    fontWeight: "800",
    textAlign: "center",
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "rgba(1, 42, 98, 0.05)",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(1, 42, 98, 0.03)",
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(1, 42, 98, 0.08)",
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: "#012a62",
    fontWeight: "600",
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#012a62",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  // Order Card Bubble Styling
  orderCard: {
    backgroundColor: "#fffef5",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#012a6215",
    padding: 12,
    marginTop: 8,
    width: 220,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#012a62",
  },
  statusBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#012a62",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 8,
  },
  orderBody: {
    paddingVertical: 2,
  },
  itemText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
    marginBottom: 4,
  },
  orderFooter: {
    marginTop: 2,
  },
  etaText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#012a62",
  },
  addrText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
  },
  recommendStore: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
  },
  recommendPrice: {
    fontSize: 13,
    fontWeight: "900",
    color: "#012a62",
    marginTop: 4,
  },
  recommendBtn: {
    backgroundColor: "#012a62",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 8,
    justifyContent: "center",
  },
  recommendBtnText: {
    color: "#fdde59",
    fontSize: 11,
    fontWeight: "800",
  },
  stripContainer: {
    marginTop: 8,
    width: "100%",
  },
  stripTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#012a6260",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stripScroll: {
    gap: 8,
    flexDirection: "row",
    paddingBottom: 4,
  },
  stripCard: {
    width: 110,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(1, 42, 98, 0.08)",
    padding: 8,
    shadowColor: "#012a62",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  stripImageWrapper: {
    width: "100%",
    height: 70,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stripImage: {
    width: "100%",
    height: "100%",
  },
  stripFallbackBg: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  stripProdName: {
    fontSize: 10.5,
    fontWeight: "750",
    color: "#012a62",
  },
  stripStoreName: {
    fontSize: 8.5,
    color: "#012a6250",
    fontWeight: "600",
    marginTop: 1,
  },
  stripPrice: {
    fontSize: 10.5,
    fontWeight: "850",
    color: "#012a62",
    marginTop: 2,
  },
});
