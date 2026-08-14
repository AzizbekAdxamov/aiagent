// DB'dagi saqlangan token'ni o'qish (login rate-limit paytida ishlatish uchun)
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
const prisma = new PrismaClient();

const user = await prisma.mentalabaUser.findFirst({
  where: { accessToken: { not: "" } },
  select: { id: true, accessToken: true, refreshToken: true, tokenExpiresAt: true },
  orderBy: { updatedAt: "desc" },
});
if (!user) {
  console.log("USER TOPILMADI");
  process.exit(1);
}
console.log("user:", user.id, "expires:", user.tokenExpiresAt);
if (user.accessToken) {
  writeFileSync(".test-tokens.json", JSON.stringify({
    token: user.accessToken,
    refreshToken: user.refreshToken || "",
  }));
  console.log("tokenga yozildi, len:", user.accessToken.length);
} else {
  console.log("accessToken yo'q — login kerak");
}
await prisma.$disconnect();
