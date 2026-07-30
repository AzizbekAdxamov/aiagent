import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { lookupManager } from "@/data/lookups";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const universityId = searchParams.get("universityId");
    const degree = searchParams.get("degree");
    const language = searchParams.get("language");
    const search = searchParams.get("search");

    const where: any = {};
    if (universityId) where.universityId = parseInt(universityId);
    if (search) {
      where.OR = [
        { nameUz: { contains: search } },
        { nameEn: { contains: search } },
      ];
    }

    const [directions, totalCount] = await Promise.all([
      prisma.direction.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          educationTypeLanguages: true,
          university: {
            select: { id: true, fullNameUz: true, slug: true, logo: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.direction.count({ where }),
    ]);

    let filtered = directions;

    // Filter by degree
    if (degree) {
      const degreeMap: Record<string, number> = { bachelor: 1, master: 2, phd: 3, transfer: 4 };
      const degreeId = degreeMap[degree];
      if (degreeId) {
        filtered = filtered.filter((d) => d.degreeIds.includes(degreeId));
      }
    }

    // Filter by language
    if (language) {
      const langMap: Record<string, number> = { english: 2, uzbek: 1, russian: 3 };
      const langId = langMap[language];
      if (langId) {
        filtered = filtered.filter((d) =>
          d.educationTypeLanguages.some((etl) => etl.educationLanguageId === langId)
        );
      }
    }

    const data = filtered.map((d) => ({
      ...d,
      degreeNames: d.degreeIds.map((id) => lookupManager.getDegreeName(id, "uz")),
      educationTypeLanguages: d.educationTypeLanguages.map((etl) => ({
        ...etl,
        educationTypeName: lookupManager.getEducationTypeName(etl.educationTypeId, "uz"),
        educationLanguageName: lookupManager.getEducationLanguageName(etl.educationLanguageId, "uz"),
      })),
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
    return NextResponse.json(
      { success: false, error: "Failed to fetch directions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const direction = await prisma.direction.create({
      data: body,
    });
    return NextResponse.json({ success: true, data: direction }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create direction" },
      { status: 500 }
    );
  }
}
