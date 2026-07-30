import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const university = searchParams.get("university");
    const region = searchParams.get("region");

    const where: any = { status: "active" };
    if (university) {
      where.universitySlugName = { contains: university.toLowerCase() };
    }
    if (region) {
      where.regionNameUz = { contains: region };
    }

    const [grants, totalCount] = await Promise.all([
      prisma.universityGrant.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.universityGrant.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: grants,
      pageInfo: {
        currentCount: grants.length,
        totalCount,
        offset,
        limit,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch grants" },
      { status: 500 }
    );
  }
}
