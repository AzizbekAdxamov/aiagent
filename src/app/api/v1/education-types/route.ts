import { NextResponse } from "next/server";
import { EDUCATION_TYPES } from "@/data/lookups";

export async function GET() {
  return NextResponse.json(EDUCATION_TYPES);
}
