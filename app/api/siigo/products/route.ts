import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/lib/siigo";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const code = searchParams.get("code") || undefined;
    const created_start = searchParams.get("created_start") || undefined;
    const created_end = searchParams.get("created_end") || undefined;
    const updated_start = searchParams.get("updated_start") || undefined;
    const updated_end = searchParams.get("updated_end") || undefined;
    const ids = searchParams.get("ids") || undefined;
    
    const pageStr = searchParams.get("page");
    const pageSizeStr = searchParams.get("page_size");
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const page_size = pageSizeStr ? parseInt(pageSizeStr, 10) : undefined;

    const data = await getProducts({
      code,
      created_start,
      created_end,
      updated_start,
      updated_end,
      ids,
      page,
      page_size,
    });

    return NextResponse.json({ success: true, ...data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
