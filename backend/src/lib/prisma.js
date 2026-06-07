const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

// Prisma 7's client engine requires an explicit driver adapter — pg for PostgreSQL/Supabase
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Single shared instance — avoids exhausting DB connections in dev with hot-reload
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
