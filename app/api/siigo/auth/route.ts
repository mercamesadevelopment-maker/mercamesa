import { NextResponse } from "next/server";
import { getSiigoToken } from "@/lib/siigo";

export async function GET() {
  try {
    const token = await getSiigoToken();
    return NextResponse.json({ success: true, token }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
