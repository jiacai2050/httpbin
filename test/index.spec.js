import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

// https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/
const ROOT = "https://httpbin.liujiacai.net";
describe("httpbin worker", async () => {
  it("index page", async () => {
    const response = await fetch(`${ROOT}`);
    expect(await response.text()).toContain(`httpbin`);
  });

  it("redirect-to success", async () => {
    const response = await fetch(
      `${ROOT}/redirect-to?url=http://httpbin.org/ip`,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("http://httpbin.org/ip");
  });

  it("redirect-to no url parameters ", async () => {
    const response = await fetch(`${ROOT}/redirect-to`);
    expect(response.status).toBe(400);
  });

  it("redirect 3 times", async () => {
    for (let i = 3; i > 0; i--) {
      const response = await fetch(`${ROOT}/redirect/${i}`);
      expect(response.status).toBe(302);
      const location = response.headers.get("Location");
      if (i > 1) {
        expect(location).toBe(`${ROOT}/redirect/${i - 1}`);
      } else {
        expect(location).toBe(`${ROOT}/get`);
      }
    }
  });

  it("redirect-to invalid number", async () => {
    const response = await fetch(`${ROOT}/redirect-to/abc`);
    expect(response.status).toBe(400);
  });

  it("response-headers", async () => {
    const response = await fetch(`${ROOT}/response-headers?a=1&b=2`);
    expect(response.headers.get("a")).toBe("1");
    expect(response.headers.get("b")).toBe("2");
    expect(await response.json()).toMatchObject({ a: "1", b: "2" });
  });

  it("ip ", async () => {
    const response = await fetch(`${ROOT}/ip`);
    expect(response.status).toBe(200);
  });

  it("status", async () => {
    const response = await fetch(`${ROOT}/status/208`);
    expect(response.status).toBe(208);
  });

  it("anything json", async () => {
    const req = new Request(`${ROOT}/anything/123`, {
      method: "PUT",
      headers: {
        "User-Agent": "Cloudflare Workers",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ a: 1, b: 2 }),
    });
    const response = await fetch(req);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json["url"]).toBe(`${ROOT}/anything/123`);
    expect(json["method"]).toStrictEqual("PUT");
    expect(json["json"]).toStrictEqual({ a: 1, b: 2 });
    expect(json["headers"]).toBeDefined();
  });

  it("anything form data", async () => {
    let formData = new FormData();
    formData.append("name", "John");
    formData.append("password", "John123");
    formData.append(
      "file1",
      new Blob(["file content"], { type: "text/plain" }),
      "test.txt",
    );

    const req = new Request(`${ROOT}/anything/123`, {
      method: "PUT",
      body: formData,
    });
    const response = await fetch(req);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json["url"]).toBe(`${ROOT}/anything/123`);
    expect(json["method"]).toStrictEqual("PUT");
    expect(json["form"]).toStrictEqual({ name: "John", password: "John123" });
    expect(json["files"]).toStrictEqual({
      file1: {
        content: "file content",
        name: "test.txt",
        size: 12,
        type: "text/plain",
      },
    });
    expect(json["headers"]).toBeDefined();
  });
});

async function fetch(request) {
  if (typeof request === "string") {
    request = new Request(request);
  }
  // Create an empty context to pass to `worker.fetch()`
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
  await waitOnExecutionContext(ctx);
  return response;
}
