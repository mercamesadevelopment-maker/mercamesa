import { NextRequest, NextResponse } from "next/server";
import { getPaymentTypes } from "@/lib/siigo";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const documentType = searchParams.get("document_type") || undefined;

    const data = await getPaymentTypes(documentType);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
