import { NextResponse } from "next/server";
import { INSTITUTION_CATEGORIES } from "@/data/lookups";

export async function GET() {
  return NextResponse.json(INSTITUTION_CATEGORIES);
}
