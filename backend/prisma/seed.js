const bcrypt = require("bcrypt");
const prisma = require("../src/lib/prisma");

// Creates a couple of stores, a handful of products, and one account per role.
// Run with: npx prisma db seed
async function main() {
  const password = await bcrypt.hash("password123", 10);

  const store = await prisma.store.create({
    data: { name: "Sneaker House", location: "Level 1, Unit 12" },
  });

  await prisma.product.create({
    data: {
      name: "Air Runner 2",
      price: 89.99,
      images: [],
      category: "Footwear",
      trending: true,
      storeId: store.id,
      variants: { create: [{ size: "8", stock: 5 }, { size: "9", stock: 5 }] },
    },
  });

  const accounts = [
    { email: "customer@voda.test", phone: "+10000000001", role: "CUSTOMER" },
    { email: "runner@voda.test", phone: "+10000000002", role: "RUNNER" },
    { email: "rider@voda.test", phone: "+10000000003", role: "RIDER" },
    { email: "store@voda.test", phone: "+10000000004", role: "STORE_STAFF", storeId: store.id },
  ];

  for (const account of accounts) {
    await prisma.user.create({ data: { ...account, password } });
  }

  console.log("Seed complete. All test accounts use password: password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
