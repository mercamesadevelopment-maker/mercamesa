import { NextResponse } from "next/server";
import { getAccountGroups } from "@/lib/siigo";

export async function GET() {
  try {
    const data = await getAccountGroups();
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
