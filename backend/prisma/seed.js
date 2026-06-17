require("dotenv").config();
const bcrypt = require("bcrypt");
const prisma = require("../src/lib/prisma");

// Mapping for standard original products to preserve and clean up
const originalProductsMapping = {
  "Air Runner 2": { category: "Sneakers", storeId: "f7d3ad59-b76f-4eae-b812-83f2836a9dac" },
  "Cloud Walker Pro": { category: "Sneakers", storeId: "f7d3ad59-b76f-4eae-b812-83f2836a9dac" },
  "Street Classic Low": { category: "Sneakers", storeId: "f7d3ad59-b76f-4eae-b812-83f2836a9dac" },
  "Court Ace White": { category: "Sneakers", storeId: "f7d3ad59-b76f-4eae-b812-83f2836a9dac" },
  "Trail Blazer X": { category: "Boots", storeId: "f7d3ad59-b76f-4eae-b812-83f2836a9dac" },
  "Signature Trench Coat": { category: "Apparel", storeId: "e0a3b04c-83b3-4f51-b0db-6e6b5dcf0234" },
  "Slim Fit Oxford Shirt": { category: "Apparel", storeId: "e0a3b04c-83b3-4f51-b0db-6e6b5dcf0234" },
  "Cargo Utility Pants": { category: "Apparel", storeId: "d1c4a0f3-8b7c-4a34-a212-32a87a6b2319" },
  "Oversized Knit Hoodie": { category: "Apparel", storeId: "d1c4a0f3-8b7c-4a34-a212-32a87a6b2319" },
  "Linen Resort Shorts": { category: "Apparel", storeId: "e0a3b04c-83b3-4f51-b0db-6e6b5dcf0234" }
};

// Helper function to upsert a product and its variants safely
async function upsertProduct(productData) {
  const { name, price, images, category, trending, storeId, variants } = productData;

  const existingProduct = await prisma.product.findFirst({
    where: { name, storeId }
  });

  let product;
  if (existingProduct) {
    console.log(`Updating existing product: ${name}`);
    product = await prisma.product.update({
      where: { id: existingProduct.id },
      data: {
        price,
        images,
        category,
        trending
      }
    });

    for (const v of variants) {
      const existingVariant = await prisma.variant.findFirst({
        where: { productId: product.id, size: v.size }
      });
      if (existingVariant) {
        await prisma.variant.update({
          where: { id: existingVariant.id },
          data: { stock: v.stock }
        });
      } else {
        await prisma.variant.create({
          data: {
            size: v.size,
            stock: v.stock,
            productId: product.id
          }
        });
      }
    }
  } else {
    console.log(`Creating new product: ${name}`);
    product = await prisma.product.create({
      data: {
        name,
        price,
        images,
        category,
        trending,
        storeId,
        variants: {
          create: variants.map(v => ({
            size: v.size,
            stock: v.stock
          }))
        }
      }
    });
  }
  return product;
}

async function main() {
  console.log("Starting database seeding...");

  // 1. Locate or upsert anchor store 'Sneaker House'
  console.log("Upserting anchor store 'Sneaker House'...");
  const sneakerHouse = await prisma.store.upsert({
    where: { id: "f7d3ad59-b76f-4eae-b812-83f2836a9dac" },
    update: {
      name: "Sneaker House",
      location: "Level 1, Unit 12"
    },
    create: {
      id: "f7d3ad59-b76f-4eae-b812-83f2836a9dac",
      name: "Sneaker House",
      location: "Level 1, Unit 12"
    }
  });

  // 2. Inject 2 brand new physical store entries
  console.log("Upserting new physical storefronts...");
  const zaraLuxeHub = await prisma.store.upsert({
    where: { id: "e0a3b04c-83b3-4f51-b0db-6e6b5dcf0234" },
    update: {
      name: "Zara Luxe Hub",
      location: "Level 2, Unit 4"
    },
    create: {
      id: "e0a3b04c-83b3-4f51-b0db-6e6b5dcf0234",
      name: "Zara Luxe Hub",
      location: "Level 2, Unit 4"
    }
  });

  const stellarActivewear = await prisma.store.upsert({
    where: { id: "d1c4a0f3-8b7c-4a34-a212-32a87a6b2319" },
    update: {
      name: "Stellar Activewear",
      location: "Level 1, Unit 18"
    },
    create: {
      id: "d1c4a0f3-8b7c-4a34-a212-32a87a6b2319",
      name: "Stellar Activewear",
      location: "Level 1, Unit 18"
    }
  });

  // 3. Update or distribute existing standalone records in Product table
  console.log("Updating and distributing existing products to valid stores and categories...");
  const existingProducts = await prisma.product.findMany();
  for (const product of existingProducts) {
    let targetStoreId = product.storeId;
    let targetCategory = product.category;

    const originalMapping = originalProductsMapping[product.name];
    if (originalMapping) {
      targetCategory = originalMapping.category;
      targetStoreId = originalMapping.storeId;
    } else {
      const nameLower = product.name.toLowerCase();
      const categoryLower = product.category.toLowerCase();

      if (nameLower.includes("boot") || categoryLower.includes("boot")) {
        targetCategory = "Boots";
        targetStoreId = sneakerHouse.id;
      } else if (
        nameLower.includes("sneaker") ||
        nameLower.includes("runner") ||
        nameLower.includes("shoe") ||
        nameLower.includes("court") ||
        nameLower.includes("trail") ||
        categoryLower.includes("footwear") ||
        categoryLower.includes("sneakers")
      ) {
        targetCategory = "Sneakers";
        if (nameLower.includes("apex") || nameLower.includes("nova") || nameLower.includes("active")) {
          targetStoreId = stellarActivewear.id;
        } else {
          targetStoreId = sneakerHouse.id;
        }
      } else {
        targetCategory = "Apparel";
        if (
          nameLower.includes("active") ||
          nameLower.includes("hoodie") ||
          nameLower.includes("pullover") ||
          nameLower.includes("utility") ||
          nameLower.includes("track") ||
          nameLower.includes("tee") ||
          nameLower.includes("compression")
        ) {
          targetStoreId = stellarActivewear.id;
        } else {
          targetStoreId = zaraLuxeHub.id;
        }
      }
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        category: targetCategory,
        storeId: targetStoreId
      }
    });
  }

  // 4. Seed new products for each new store
  console.log("Seeding catalog products for Zara Luxe Hub...");
  const zaraProducts = [
    {
      name: "Classic Trench Coat",
      price: 14990.00,
      images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800"],
      category: "Apparel",
      trending: true,
      storeId: zaraLuxeHub.id,
      variants: [
        { size: "S", stock: 15 },
        { size: "M", stock: 20 },
        { size: "L", stock: 15 },
        { size: "XL", stock: 8 }
      ]
    },
    {
      name: "Slim Fit Dress Shirt",
      price: 5490.00,
      images: ["https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=800"],
      category: "Apparel",
      trending: false,
      storeId: zaraLuxeHub.id,
      variants: [
        { size: "S", stock: 10 },
        { size: "M", stock: 15 },
        { size: "L", stock: 12 },
        { size: "XL", stock: 6 }
      ]
    },
    {
      name: "Tailored Linen Blazer",
      price: 11990.00,
      images: ["https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800"],
      category: "Apparel",
      trending: true,
      storeId: zaraLuxeHub.id,
      variants: [
        { size: "S", stock: 8 },
        { size: "M", stock: 12 },
        { size: "L", stock: 10 }
      ]
    },
    {
      name: "Modern Fit Chinos",
      price: 6990.00,
      images: ["https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800"],
      category: "Apparel",
      trending: false,
      storeId: zaraLuxeHub.id,
      variants: [
        { size: "S", stock: 12 },
        { size: "M", stock: 18 },
        { size: "L", stock: 15 }
      ]
    },
    {
      name: "Premium Knit Sweater",
      price: 7990.00,
      images: ["https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800"],
      category: "Apparel",
      trending: true,
      storeId: zaraLuxeHub.id,
      variants: [
        { size: "S", stock: 10 },
        { size: "M", stock: 14 },
        { size: "L", stock: 12 }
      ]
    }
  ];

  for (const productData of zaraProducts) {
    await upsertProduct(productData);
  }

  console.log("Seeding catalog products for Stellar Activewear...");
  const stellarProducts = [
    {
      name: "Apex Running Shoes",
      price: 9990.00,
      images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800"],
      category: "Sneakers",
      trending: true,
      storeId: stellarActivewear.id,
      variants: [
        { size: "UK 7", stock: 10 },
        { size: "UK 8", stock: 15 },
        { size: "UK 9", stock: 15 },
        { size: "UK 10", stock: 8 }
      ]
    },
    {
      name: "Athletic Pullover Hoodie",
      price: 7199.00,
      images: ["https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800"],
      category: "Apparel",
      trending: true,
      storeId: stellarActivewear.id,
      variants: [
        { size: "S", stock: 15 },
        { size: "M", stock: 20 },
        { size: "L", stock: 15 },
        { size: "XL", stock: 10 }
      ]
    },
    {
      name: "Utility Track Pants",
      price: 6490.00,
      images: ["https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800"],
      category: "Apparel",
      trending: false,
      storeId: stellarActivewear.id,
      variants: [
        { size: "S", stock: 12 },
        { size: "M", stock: 18 },
        { size: "L", stock: 15 }
      ]
    },
    {
      name: "Stellar Training Tee",
      price: 2990.00,
      images: ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800"],
      category: "Apparel",
      trending: false,
      storeId: stellarActivewear.id,
      variants: [
        { size: "S", stock: 20 },
        { size: "M", stock: 25 },
        { size: "L", stock: 20 }
      ]
    },
    {
      name: "Trail Grip Boots",
      price: 12990.00,
      images: ["https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800"],
      category: "Boots",
      trending: true,
      storeId: stellarActivewear.id,
      variants: [
        { size: "UK 8", stock: 8 },
        { size: "UK 9", stock: 12 },
        { size: "UK 10", stock: 10 }
      ]
    }
  ];

  for (const productData of stellarProducts) {
    await upsertProduct(productData);
  }

  // 5. Seed test accounts safely via upsert
  console.log("Upserting test accounts...");
  const password = await bcrypt.hash("password123", 10);
  const accounts = [
    { email: "customer@voda.test", phone: "+10000000001", role: "CUSTOMER" },
    { email: "runner@voda.test",   phone: "+10000000002", role: "RUNNER" },
    { email: "rider@voda.test",    phone: "+10000000003", role: "RIDER" },
    { email: "store@voda.test",    phone: "+10000000004", role: "STORE_STAFF", storeId: sneakerHouse.id }
  ];

  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        phone: account.phone,
        role: account.role,
        password,
        storeId: account.storeId || null
      },
      create: {
        email: account.email,
        phone: account.phone,
        role: account.role,
        password,
        storeId: account.storeId || null
      }
    });
  }

  console.log("Seed complete successfully. All test accounts use password: password123");
}

main()
  .catch((err) => {
    console.error("Critical error during database seeding:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
