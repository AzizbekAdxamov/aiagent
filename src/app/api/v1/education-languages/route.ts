import { NextResponse } from "next/server";
import { EDUCATION_LANGUAGES } from "@/data/lookups";

export async function GET() {
  return NextResponse.json(EDUCATION_LANGUAGES);
}
