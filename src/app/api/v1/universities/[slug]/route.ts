import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { lookupManager } from "@/data/lookups";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const university = await prisma.university.findFirst({
      where: {
        OR: [
          { slug: params.slug },
          { abbrNameUz: params.slug.toUpperCase() },
          { abbrNameEn: params.slug.toUpperCase() },
        ],
      },
      include: {
        gallery: { orderBy: { order: "asc" } },
        directions: {
          take: 10,
          include: {
            educationTypeLanguages: true,
          },
        },
      },
    });

    if (!university) {
      return NextResponse.json(
        { success: false, error: "University not found" },
        { status: 404 }
      );
    }

    const data = {
      ...university,
      institutionCategoryName: lookupManager.getCategoryName(university.institutionCategoryId ?? 4, "uz"),
      locationName: lookupManager.getRegionName(university.locationId ?? 14, "uz"),
      directions: university.directions.map((d) => ({
        ...d,
        degreeNames: d.degreeIds.map((id) => lookupManager.getDegreeName(id, "uz")),
        educationTypeLanguages: d.educationTypeLanguages.map((etl) => ({
          ...etl,
          educationTypeName: lookupManager.getEducationTypeName(etl.educationTypeId, "uz"),
          educationLanguageName: lookupManager.getEducationLanguageName(etl.educationLanguageId, "uz"),
        })),
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch university" },
      { status: 500 }
    );
  }
}
