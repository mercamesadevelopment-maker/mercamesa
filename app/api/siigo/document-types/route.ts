import { NextRequest, NextResponse } from "next/server";
import { getDocumentTypes } from "@/lib/siigo";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") || undefined;

    const data = await getDocumentTypes(type);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
