import { NextRequest, NextResponse } from "next/server";

/**
 * Universal proxy to the existing Express backend.
 * Catches all /api/proxy/[...path] requests and forwards them to BACKEND_URL.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  const { path } = await params;
  const apiPath = path.join("/");
  const search = request.nextUrl.search;
  const url = `${BACKEND_URL}/api/${apiPath}${search}`;

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
    };

    if (method !== "GET" && method !== "HEAD") {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // no body
      }
    }

    const res = await fetch(url, fetchOptions);

    // Try JSON first, fallback to text
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      // BE returned non-JSON (e.g. HTML 404 page)
      return NextResponse.json(
        { success: false, message: text.substring(0, 200) },
        { status: res.status }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: `Backend không phản hồi: ${e.message}` },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, params, "GET");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, params, "POST");
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, params, "PUT");
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, params, "PATCH");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, params, "DELETE");
}
