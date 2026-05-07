/// <reference types="node" />

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log("Seeding database...");

  // Upsert an Admin User
  const admin = await prisma.user.upsert({
    where: { email: "admin@dbs.edu.hk" },
    update: {},
    create: {
      email: "admin@dbs.edu.hk",
      name: "Admin Teacher",
      role: "ADMIN",
      group: "STAFF",
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Upsert a Student User
  const student = await prisma.user.upsert({
    where: { email: "student@g.dbs.edu.hk" },
    update: {},
    create: {
      email: "student@g.dbs.edu.hk",
      name: "Demo Student",
      role: "STUDENT",
      group: "MO",
    },
  });
  console.log(`Created student user: ${student.email}`);

  // Create a Demo Problem Set
  const set = await prisma.problemSet.upsert({
    where: { slug: "demo-set-001" },
    update: {},
    create: {
      slug: "demo-set-001",
      title: "Demo Algebra Set",
      description: "A set of algebra practice problems for demo purposes.",
      order: "1",
      status: "PUBLISHED",
      difficulty: 2,
      topicTags: ["Algebra"],
      allowedGroups: [],
      createdById: admin.id,
      problems: {
        create: [
          { number: 1, answerKey: "42", answerType: "INTEGER", points: 1, topicTags: ["Algebra"] },
          {
            number: 2,
            answerKey: "1/2",
            answerType: "FRACTION",
            acceptedAnswers: ["0.5"],
            points: 1,
            topicTags: ["Fractions"],
          },
          { number: 3, answerKey: "x=2", answerType: "EXACT", points: 1, topicTags: ["Equations"] },
        ],
      },
    },
  });
  console.log(`Created problem set: ${set.slug}`);

  // Create a demo feedback report
  const report = await prisma.feedbackReport.create({
    data: {
      userId: student.id,
      problemSetId: set.id,
      type: "TYPO",
      message: "There is a typo in question 1.",
      status: "OPEN",
    },
  });
  console.log(`Created feedback report: ${report.id}`);

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
