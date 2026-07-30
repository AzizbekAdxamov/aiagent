import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { lookupManager } from "@/data/lookups";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const category = searchParams.get("category");
    const region = searchParams.get("region");
    const hasGrant = searchParams.get("hasGrant");
    const search = searchParams.get("search");
    const slug = searchParams.get("slug");

    // Slug lookup
    if (slug) {
      const uni = await prisma.university.findFirst({
        where: {
          OR: [
            { slug: { contains: slug.toLowerCase() } },
            { abbrNameUz: slug.toUpperCase() },
            { abbrNameEn: slug.toUpperCase() },
          ],
        },
        include: { gallery: true },
      });
      if (!uni) {
        return NextResponse.json({ success: false, error: "University not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: {
          slug: uni.slug,
          id: uni.id,
          fullNameUz: uni.fullNameUz,
        },
      });
    }

    // Build filter
    const where: any = { isBanned: false };
    if (category) where.institutionCategoryId = parseInt(category);
    if (region) where.locationId = parseInt(region);
    if (hasGrant === "true") where.hasGrant = true;
    if (search) {
      where.OR = [
        { fullNameUz: { contains: search } },
        { fullNameEn: { contains: search } },
        { abbrNameUz: { contains: search } },
        { abbrNameEn: { contains: search } },
      ];
    }

    const [universities, totalCount] = await Promise.all([
      prisma.university.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { gallery: { take: 3 } },
      }),
      prisma.university.count({ where }),
    ]);

    const data = universities.map((u) => ({
      ...u,
      institutionCategoryName: lookupManager.getCategoryName(u.institutionCategoryId ?? 4, "uz"),
      locationName: lookupManager.getRegionName(u.locationId ?? 14, "uz"),
    }));

    return NextResponse.json({
      success: true,
      data,
      pageInfo: {
        currentCount: data.length,
        totalCount,
        offset,
        limit,
      },
    });
  } catch (error) {
    console.error("[Universities Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch universities" },
      { status: 500 }
    );
  }
}
