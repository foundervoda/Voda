const bcrypt = require("bcrypt");
const prisma = require("../src/lib/prisma");

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const sneakerHouse = await prisma.store.create({
    data: { name: "Sneaker House", location: "Level 1, Unit 12" },
  });

  const urbanThreads = await prisma.store.create({
    data: { name: "Urban Threads", location: "Level 2, Unit 7" },
  });

  // Sneaker House products
  await prisma.product.create({
    data: {
      name: "Air Runner 2",
      price: 89.99,
      images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800"],
      category: "Footwear",
      trending: true,
      storeId: sneakerHouse.id,
      variants: { create: [{ size: "7", stock: 3 }, { size: "8", stock: 5 }, { size: "9", stock: 4 }, { size: "10", stock: 2 }] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Cloud Walker Pro",
      price: 119.99,
      images: ["https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800"],
      category: "Footwear",
      trending: true,
      storeId: sneakerHouse.id,
      variants: { create: [{ size: "7", stock: 0 }, { size: "8", stock: 2 }, { size: "9", stock: 6 }] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Street Classic Low",
      price: 64.99,
      images: ["https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800"],
      category: "Footwear",
      trending: false,
      storeId: sneakerHouse.id,
      variants: { create: [{ size: "8", stock: 8 }, { size: "9", stock: 5 }, { size: "10", stock: 3 }] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Court Ace White",
      price: 74.99,
      images: ["https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800"],
      category: "Footwear",
      trending: false,
      storeId: sneakerHouse.id,
      variants: { create: [{ size: "7", stock: 4 }, { size: "8", stock: 4 }, { size: "9", stock: 1 }] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Trail Blazer X",
      price: 99.99,
      images: ["https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800"],
      category: "Footwear",
      trending: true,
      storeId: sneakerHouse.id,
      variants: { create: [{ size: "8", stock: 3 }, { size: "9", stock: 3 }, { size: "10", stock: 2 }] },
    },
  });

  // Urban Threads products
  await prisma.product.create({
    data: {
      name: "Signature Trench Coat",
      price: 149.90,
      images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800"],
      category: "Apparel",
      trending: true,
      storeId: urbanThreads.id,
      variants: { create: [{ size: "XS", stock: 2 }, { size: "S", stock: 2 }, { size: "M", stock: 0 }, { size: "L", stock: 4 }, { size: "XL", stock: 3 }] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Slim Fit Oxford Shirt",
      price: 54.99,
      images: ["https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=800"],
      category: "Apparel",
      trending: false,
      storeId: urbanThreads.id,
      variants: { create: [{ size: "S", stock: 5 }, { size: "M", stock: 6 }, { size: "L", stock: 4 }, { size: "XL", stock: 2 }] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Cargo Utility Pants",
      price: 69.99,
      images: ["https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800"],
      category: "Apparel",
      trending: true,
      storeId: urbanThreads.id,
      variants: { create: [{ size: "S", stock: 3 }, { size: "M", stock: 5 }, { size: "L", stock: 3 }, { size: "XL", stock: 1 }] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Oversized Knit Hoodie",
      price: 79.99,
      images: ["https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800"],
      category: "Apparel",
      trending: true,
      storeId: urbanThreads.id,
      variants: { create: [{ size: "S", stock: 4 }, { size: "M", stock: 3 }, { size: "L", stock: 2 }, { size: "XL", stock: 0 }] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Linen Resort Shorts",
      price: 39.99,
      images: ["https://images.unsplash.com/photo-1591195853828-11db59a44f43?w=800"],
      category: "Apparel",
      trending: false,
      storeId: urbanThreads.id,
      variants: { create: [{ size: "S", stock: 6 }, { size: "M", stock: 5 }, { size: "L", stock: 4 }] },
    },
  });

  const accounts = [
    { email: "customer@voda.test", phone: "+10000000001", role: "CUSTOMER" },
    { email: "runner@voda.test",   phone: "+10000000002", role: "RUNNER" },
    { email: "rider@voda.test",    phone: "+10000000003", role: "RIDER" },
    { email: "store@voda.test",    phone: "+10000000004", role: "STORE_STAFF", storeId: sneakerHouse.id },
  ];

  for (const account of accounts) {
    await prisma.user.create({ data: { ...account, password } });
  }

  console.log("Seed complete. All test accounts use password: password123");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
