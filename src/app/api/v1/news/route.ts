import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// request.url ishlatilgani uchun statik render qilinmaydi (DYNAMIC_SERVER_USAGE xatosini oldini oladi)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const universityId = searchParams.get("universityId");
    const relatedTo = searchParams.get("relatedTo");

    const where: any = { status: "active" };
    if (universityId) where.universityId = parseInt(universityId);
    if (relatedTo) where.relatedTo = relatedTo;

    const [news, totalCount] = await Promise.all([
      prisma.news.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          university: { select: { id: true, fullNameUz: true, slug: true } },
        },
      }),
      prisma.news.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: news,
      pageInfo: {
        currentCount: news.length,
        totalCount,
        offset,
        limit,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const news = await prisma.news.create({ data: body });
    return NextResponse.json({ success: true, data: news }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create news" },
      { status: 500 }
    );
  }
}
