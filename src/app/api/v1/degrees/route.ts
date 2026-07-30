import { NextResponse } from "next/server";
import { DEGREES } from "@/data/lookups";

export async function GET() {
  return NextResponse.json(DEGREES);
}
