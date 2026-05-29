import { NextResponse } from "next/server";
import https from "https";

export async function GET() {
  const testUrls = ["https://accounts.google.com", "https://oauth2.googleapis.com"];
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS || "(not set)",
      SSL_CERT_FILE: process.env.SSL_CERT_FILE || "(not set)",
      SSL_CERT_DIR: process.env.SSL_CERT_DIR || "(not set)",
      HTTPS_PROXY: process.env.HTTPS_PROXY || "(not set)",
      HTTP_PROXY: process.env.HTTP_PROXY || "(not set)",
    },
    tests: {} as Record<string, any>,
  };

  for (const url of testUrls) {
    results.tests[url] = await testHttpsConnection(url);
  }

  return NextResponse.json(results);
}

async function testHttpsConnection(url: string): Promise<any> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = https.get(url, (res) => {
      resolve({
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        elapsed_ms: Date.now() - startTime,
        headers: {
          "content-type": res.headers["content-type"],
          "server": res.headers["server"],
        },
        success: true,
      });
      res.resume();
      res.on("end", () => {});
    });

    req.on("error", (e: any) => {
      resolve({
        success: false,
        elapsed_ms: Date.now() - startTime,
        error: {
          message: e.message,
          code: e.code,
          errno: e.errno,
          syscall: e.syscall,
          hostname: e.hostname,
        },
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
