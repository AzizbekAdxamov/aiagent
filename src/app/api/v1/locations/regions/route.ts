import { NextResponse } from "next/server";
import { REGIONS } from "@/data/lookups";

export async function GET() {
  return NextResponse.json(REGIONS);
}
