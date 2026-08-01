import { NextRequest, NextResponse } from "next/server";
import https from "https";

type TestResult = {
  statusCode?: number;
  statusMessage?: string;
  elapsed_ms: number;
  headers?: Record<string, string | undefined>;
  success: boolean;
  error?: Record<string, unknown>;
};

type ApiResponse = {
  timestamp: string;
  nodeVersion: string;
  env: Record<string, string>;
  tests: Record<string, TestResult>;
};

function readToken(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || request.nextUrl.searchParams.get("token") || "";
}

export async function GET(request: NextRequest) {
  const requiredToken = process.env.DEBUG_RUNTIME_ENV_TOKEN;
  if (!requiredToken && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (requiredToken && readToken(request) !== requiredToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const testUrls = ["https://accounts.google.com", "https://oauth2.googleapis.com"] as const;
  const results: ApiResponse = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS || "(not set)",
      SSL_CERT_FILE: process.env.SSL_CERT_FILE || "(not set)",
      SSL_CERT_DIR: process.env.SSL_CERT_DIR || "(not set)",
      HTTPS_PROXY: process.env.HTTPS_PROXY || "(not set)",
      HTTP_PROXY: process.env.HTTP_PROXY || "(not set)",
    },
    tests: {},
  };

  for (const url of testUrls) {
    results.tests[url] = await testHttpsConnection(url);
  }

  return NextResponse.json(results);
}

async function testHttpsConnection(url: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = https.get(url, (res) => {
      resolve({
        statusCode: res.statusCode,
        statusMessage: res.statusMessage ?? undefined,
        elapsed_ms: Date.now() - startTime,
        headers: {
          "content-type": (res.headers["content-type"] as string) || undefined,
          "server": (res.headers["server"] as string) || undefined,
        },
        success: true,
      });
      res.resume();
      res.on("end", () => {});
    });

    req.on("error", (e: NodeJS.ErrnoException) => {
      const errorDetails: Record<string, unknown> = {
        message: e.message,
      };
      if (e.code) errorDetails.code = e.code;
      if (e.errno) errorDetails.errno = e.errno;
      if (e.syscall) errorDetails.syscall = e.syscall;
      resolve({
        success: false,
        elapsed_ms: Date.now() - startTime,
        error: errorDetails,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        elapsed_ms: Date.now() - startTime,
        error: { message: "Timeout after 10s" },
      });
    });

    req.setTimeout(10000);
  });
}
