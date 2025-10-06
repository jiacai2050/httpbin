import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

// https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/
const ROOT = "https://edgebin.liujiacai.net";
describe("http methods", () => {
  it("200", async () => {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const request = new Request(`${ROOT}/${method}`, { method: method });
      const response = await fetch(request);
      expect(response.status).toBe(200);
    }
  });
});

describe("Basic Auth", () => {
  it("no header", async () => {
    let response = await fetch(`${ROOT}/basic-auth/admin/123`);
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toStrictEqual(
      `Basic realm="Fake Realm"`,
    );
  });
  it("wrong token", async () => {
    const req = new Request(`${ROOT}/basic-auth/admin/123`, {
      headers: { Authorization: `Basic ${btoa("admin:wrong")}` },
    });
    let response = await fetch(req);
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toStrictEqual(
      `Basic realm="Fake Realm"`,
    );
  });
  it("success", async () => {
    const req = new Request(`${ROOT}/basic-auth/admin/123`, {
      headers: { Authorization: `Basic ${btoa("admin:123")}` },
    });
    let response = await fetch(req);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      authenticated: true,
      user: "admin",
    });
  });
});

describe("Bearer auth", () => {
  it("no header", async () => {
    let response = await fetch(`${ROOT}/bearer`);
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toStrictEqual(`Bearer`);
  });
  it("success", async () => {
    const req = new Request(`${ROOT}/bearer`, {
      headers: { Authorization: `Bearer 12345` },
    });
    let response = await fetch(req);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      authenticated: true,
      token: "12345",
    });
  });
});

describe("Status code", () => {
  it("normal", async () => {
    // [200, 599]
    for (const code of [200, 300, 400, 500]) {
      const response = await fetch(`${ROOT}/status/${code}`);
      expect(response.status).toBe(code);
    }
  });
  it("invalid", async () => {
    let response = await fetch(`${ROOT}/status/abc`);
    expect(response.status).toBe(400);
    response = await fetch(`${ROOT}/status/100`);
    expect(response.status).toBe(499);
  });
});

describe("Request Inspection", () => {
  it("user-agent", async () => {
    const req = new Request(`${ROOT}/user-agent`, {
      headers: { "User-Agent": `Cloudflare Workers` },
    });
    const response = await fetch(req);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toStrictEqual({ "user-agent": "Cloudflare Workers" });
  });
  it("ip", async () => {
    const response = await fetch(`${ROOT}/ip`);
    expect(response.status).toBe(200);
  });
});

describe("Response Inspection", () => {
  it("response-headers", async () => {
    const req = new Request(`${ROOT}/response-headers?a=1&b=2&c=3&c=4`, {
      headers: { C: "5" },
    });
    const response = await fetch(req);
    expect(response.headers.get("a")).toBe("1");
    expect(response.headers.get("b")).toBe("2");
    expect(response.headers.get("c")).toBe("3, 4");
    expect(await response.json()).toMatchObject({
      a: "1",
      b: "2",
      c: ["5", "3", "4"],
    });
  });

  it("cache", async () => {
    const response = await fetch(`${ROOT}/cache/3600`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toStrictEqual(
      "public, max-age=3600",
    );
  });
});

describe("Response formats", () => {
  it("json", async () => {
    const response = await fetch(`${ROOT}/json`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toMatch(/application\/json/);
  });
  it("xml", async () => {
    const response = await fetch(`${ROOT}/xml`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toMatch(/application\/xml/);
  });
});

describe("Dynamic data", () => {
  it("gen bytes", async () => {
    for (const size of [10, 100, 1000, 10000]) {
      const response = await fetch(`${ROOT}/bytes/${size}`);
      expect(response.status).toBe(200);
      const arrayBuffer = await response.arrayBuffer();
      expect(arrayBuffer.byteLength).toBe(size);
    }

    const response = await fetch(`${ROOT}/bytes/65537`);
    expect(response.status, await response.text()).toBe(400);
  });

  it("base64", async () => {
    const response = await fetch(`${ROOT}/base64/SFRUUEJJTiBpcyBhd2Vzb21l`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("HTTPBIN is awesome");
  });

  it("gzip", async () => {
    const response = await fetch(`${ROOT}/gzip`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    const json = await response.json();
    expect(json["gzipped"]).toBe(true);
  });

  it("gzip integration", async () => {
    const response = await SELF.fetch(`${ROOT}/gzip`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    const json = await response.json();
    expect(json["gzipped"]).toBe(true);
  });

  it("markdown", async () => {
    const response = await fetch(`${ROOT}/markdown?text=Nice to see you!`);
    expect(response.status).toBe(200);
    expect(await response.text()).toStrictEqual("<p>Nice to see you!</p>\n");
  });
});

describe("redirect", () => {
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
        expect(location).toBe(`/redirect/${i - 1}`);
      } else {
        expect(location).toBe(`/get`);
      }
    }
  });

  it("redirect invalid number", async () => {
    for (const invalid of ["-1", "abc", ""]) {
      const response = await fetch(`${ROOT}/redirect/${invalid}`);
      expect(response.status).toBe(400);
    }
  });
});

describe("image", () => {
  it("normal", async () => {
    for (const format of ["png", "jpeg", "webp", "svg"]) {
      const response = await fetch(`${ROOT}/image/${format}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toMatch(
        new RegExp(`image/${format}`),
      );
      const arrayBuffer = await response.arrayBuffer();
      expect(arrayBuffer.byteLength).toBeGreaterThan(0);
    }
  });
});

describe("cookies", () => {
  it("set & get", async () => {
    const response = await fetch(
      `${ROOT}/cookies/set?name1=value1&name2=value2&name3=value3`,
    );
    expect(response.status).toBe(302);
    const cookies = response.headers.get("Set-Cookie");
    expect(cookies).toBeDefined();
    expect(cookies).toMatch(/name1=value1/);
    expect(cookies).toMatch(/name2=value2/);
    expect(cookies).toMatch(/name3=value3/);

    const req = new Request(`${ROOT}/cookies`, {
      headers: { Cookie: "name1=value1; name2=value2; name3=value3" },
    });
    const response2 = await fetch(req);
    expect(response2.status).toBe(200);
    const json = await response2.json();
    expect(json).toStrictEqual({
      cookies: { name1: "value1", name2: "value2", name3: "value3" },
    });
  });

  it("delete", async () => {
    const response = await fetch(
      `${ROOT}/cookies/delete?name1=value1&name2=value2`,
    );
    expect(response.status).toBe(302);
    const cookies = response.headers.get("Set-Cookie");
    expect(cookies).toBeDefined();
    expect(cookies).toMatch(/name1=;/);
    expect(cookies).toMatch(/name2=;/);
  });

  it("set (integration)", async () => {
    const response = await SELF.fetch(
      `${ROOT}/cookies/set?name1=value1&name2=value2&name3=value3`,
      {
        credentials: "include",
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      // TODO: integration test can't get cookies now.
      // cookies: { name1: "value1", name2: "value2", name3: "value3" },
      cookies: {},
    });
  });
});

describe("anything", () => {
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
