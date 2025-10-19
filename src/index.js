import { handleQRCode } from "./qrcode.js";
import { handleHtmlToMarkdown, handleMarkdownToHtml } from "./markdown.js";
import {
  CustomError,
  arrayBufferToBase64,
  extractIp,
  getDateString,
  objectFromPairs,
  sleep,
  stringToNumber,
} from "./utils.js";
import { websocketHandler } from "./ws.js";
import { handleMix } from "./mix.js";
import { handleWebhook } from "./webhook.js";
import { handlePageMeta } from "./page-meta.js";
import { serveDirHandle, serveFileHandle } from "./deno.ts";
export default {
  async fetch(req, env, ctx) {
    try {
      const origin = req.headers.get("Origin");
      if (req.method === "OPTIONS") {
        const response = new Response(null, { status: 204 });
        return addCorsHeaders(response, origin);
      }

      const resp = await handle(req, env, ctx);
      // console.log(`[${req.method}] ${req.url} -> ${resp.status}`);
      if (resp.status === 101) {
        return resp;
      }
      return addCorsHeaders(new Response(resp.body, resp), origin);
    } catch (err) {
      if (err instanceof CustomError) {
        return Response.json(
          { message: err.message, code: err.code, url: req.url },
          { status: err.code },
        );
      }
      console.error(
        `Handle request failed, err:${err.message}, url:${req.url}, stack:${err.stack}`,
      );
      return new Response(`<h1>${err.message}</h1><pre>${err.stack}</pre>`, {
        status: 499,
        headers: new Headers({
          "Content-Type": "text/html; charset=utf-8",
        }),
      });
    }
  },
};

// Add CORS headers to the response
// If an Origin header is present in the request, echo it back in the response
// Otherwise, allow all origins with "*"
function addCorsHeaders(resp, origin) {
  // Ensure CORS headers are set on all responses
  if (origin) {
    resp.headers.set("Access-Control-Allow-Origin", origin);
    resp.headers.set("Access-Control-Allow-Credentials", "true");
  } else {
    resp.headers.set("Access-Control-Allow-Origin", "*");
  }
  resp.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  resp.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  return resp;
}

const STATIC_ROUTES = {
  "/": "index.html",
  "/html": "response.html",
  "/xml": "response.xml",
  "/json": "response.json",
  "/deny": "deny.txt",
  "/version": "version.json",
  "/image/png": "image.png",
  "/image/jpeg": "image.jpeg",
  "/image/webp": "image.webp",
  "/image/svg": "logo.svg",
};

async function handle(req, env, ctx) {
  const { pathname, searchParams } = new URL(req.url);
  const filename = STATIC_ROUTES[pathname];
  if (filename) {
    return serveFileHandle(req, `./docs/${filename}`);
  }

  const parts = pathname.slice(1).split("/");
  switch (parts[0]) {
    // HTTP methods: Testing different HTTP methods
    case "get":
    case "post":
    case "put":
    case "delete":
    case "patch":
      return handleAnything(searchParams, req);

    // Authentication: Testing basic authentication
    case "basic-auth":
      return handleBasicAuth(parts, searchParams, req);
    case "bearer": {
      const auth = req.headers.get("Authorization");
      if (!auth || !auth.startsWith("Bearer ")) {
        return new Response("Unauthorized", {
          status: 401,
          headers: { "WWW-Authenticate": "Bearer" },
        });
      }
      const token = auth.substring(7);
      return Response.json({ authenticated: true, token });
    }
    // Status codes: Returning responses with specific HTTP status codes
    case "status": {
      if (parts.length === 1) {
        throw new CustomError("Status code is required", 400);
      }
      const code = stringToNumber(parts[1]);
      return Response.json({ code }, { status: code });
    }

    // Request inspection: Inspecting the request data
    case "headers":
      return new Response(
        JSON.stringify(Object.fromEntries(req.headers), null, 2),
        {
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      );
    case "ip":
    case "ipgeo":
      return new Response(JSON.stringify(extractIp(req), null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    case "user-agent":
      return Response.json({
        "user-agent": req.headers.get("User-Agent") || "unknown",
      });

    // Response inspection: Inspecting the response data
    case "response-headers": {
      const body = objectFromPairs([...req.headers, ...searchParams]);
      const headers = new Headers(searchParams);
      headers.set("Content-Type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(body, null, 2), { headers });
    }
    case "cache":
      return handleCache(parts, searchParams, req);

    // Response formats: Testing different response formats
    case "encoding": {
      const charset = parts[1];
      switch (charset) {
        case "gb2312":
          let resp = await env.ASSETS.fetch(req);
          resp = new Response(resp.body, resp);
          resp.headers.set("Content-Type", "text/html; charset=gb2312");
          return resp;
        default:
          return env.ASSETS.fetch(req);
      }
    }
    case "gzip":
    case "brotli":
    case "deflate": {
      const encoding = parts[0] === "brotli" ? "br" : parts[0];
      const headers = { "content-encoding": encoding };
      const mapping = Object.freeze({
        gzip: "gzipped",
        deflate: "deflated",
      });
      const key = mapping[parts[0]] || parts[0];
      return handleAnything(searchParams, req, {
        respHeaders: headers,
        extra: { [key]: true },
      });
    }

    // Dynamic data: Generating random and dynamic data
    case "delay": {
      if (parts.length === 1) {
        throw new CustomError("Delay seconds is required", 400);
      }
      const delay = stringToNumber(parts[1]);
      await sleep(delay);
      return Response.json({ delay });
    }
    case "bytes": {
      if (parts.length === 1) {
        throw new CustomError("Bytes count is required", 400);
      }
      const count = stringToNumber(parts[1]);
      const MAX_BYTES = 64 * 1024;
      if (count <= 0 || count > MAX_BYTES) {
        throw new CustomError(
          `Bytes count must be in range [1, ${MAX_BYTES}]`,
          400,
        );
      }
      const array = new Uint8Array(count);
      crypto.getRandomValues(array);
      return new Response(array, {
        headers: { "Content-Type": "application/octet-stream" },
      });
    }
    case "base64": {
      if (parts.length === 1) {
        throw new CustomError("Encoded value is required", 400);
      }
      const encoded = parts[1];
      try {
        const decoded = atob(encoded);
        return new Response(decoded);
      } catch (err) {
        throw new CustomError(
          "Incorrect Base64 data try: SFRUUEJJTiBpcyBhd2Vzb21l",
          400,
        );
      }
    }
    case "uuid": {
      const uuids = [];
      const count =
        parts.length > 1 ? Math.min(stringToNumber(parts[1]), 100) : 1;
      for (let i = 0; i < count; i++) {
        uuids.push(crypto.randomUUID());
      }
      return count === 1
        ? Response.json({ uuid: uuids[0] })
        : Response.json({ uuids });
    }
    case "date": {
      return Response.json({
        date: getDateString({
          timeZone: req.cf?.timezone,
          ...Object.fromEntries(searchParams),
        }),
      });
    }
    case "qrcode":
      return await handleQRCode(Object.fromEntries(searchParams));

    case "md2html":
      return await handleMarkdownToHtml(req, searchParams);
    case "html2md":
      return await handleHtmlToMarkdown(req, searchParams);
    case "page-meta":
      return await handlePageMeta(req, searchParams);

    // Cookies: Returns the cookies sent in the request
    case "cookies":
      return handleCookies(parts, searchParams, req);

    // Redirection: Testing redirection behavior
    case "redirect-to": {
      const url = searchParams.get("url");
      if (!url) {
        throw new CustomError("url parameter is required", 400);
      }
      return Response.redirect(url, 302);
    }
    case "redirect": {
      if (parts.length === 1) {
        throw new CustomError("Redirect count is required", 400);
      }
      let count = stringToNumber(parts[1]);
      if (count <= 0 || count > 10) {
        throw new CustomError("Redirect count must be in range [1, 10]", 400);
      }
      count -= 1;
      const location = count === 0 ? "/get" : `/redirect/${count}`;
      return new Response(null, {
        status: 302,
        headers: { Location: location },
      });
    }

    // Anything: Accepts any request data and returns it back in JSON format
    case "anything":
      return handleAnything(searchParams, req);

    case "mix":
      return handleMix(searchParams, req);

    case "webhook":
      return handleWebhook(searchParams, req);

    // WebSocket echo server
    case "ws":
      return websocketHandler(req);
  }

  return serveDirHandle(req, `./docs`);
}

function handleBasicAuth(parts, searchParams, req) {
  if (parts.length < 3) {
    throw new CustomError("Username and password are required", 400);
  }
  const username = parts[1];
  const password = parts[2];
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Basic ")) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Fake Realm"' },
    });
  }
  const encoded = auth.substring(6);
  const decoded = atob(encoded);
  const [reqUsername, reqPassword] = decoded.split(":");
  if (reqUsername !== username || reqPassword !== password) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Fake Realm"' },
    });
  }
  return Response.json({ authenticated: true, user: username });
}

function handleCookies(parts, searchParams, req) {
  if (parts.length === 1) {
    const cookies = {};
    req.headers
      .get("Cookie")
      ?.split(";")
      .forEach((cookie) => {
        const [name, ...rest] = cookie.split("=");
        cookies[name.trim()] = rest.join("=").trim();
      });
    return Response.json({ cookies });
  }
  const action = parts[1];
  switch (action) {
    case "set": {
      const headers = new Headers({ Location: "/cookies" });
      for (const [key, value] of searchParams) {
        headers.append("Set-Cookie", `${key}=${value}; Path=/`);
      }
      return new Response(null, { status: 302, headers });
    }
    case "delete": {
      const headers = new Headers({ Location: "/cookies" });
      for (const [key, _] of searchParams) {
        headers.append(
          "Set-Cookie",
          `${key}=; Expires=Thu, 01-Jan-1970 00:00:00 GMT; Max-Age=0; Path=/`,
        );
      }
      return new Response(null, { status: 302, headers });
    }
    default:
      throw new CustomError(`Unknown cookie action: ${action}`, 400);
  }
}

function handleCache(parts, searchParams, req) {
  if (parts.length === 1) {
    // /cache
    // Returns a 304 if an If-Modified-Since header or If-None-Match is present. Returns the same as a GET otherwise.
    if (
      req.headers.get("If-None-Match") ||
      req.headers.get("If-Modified-Since")
    ) {
      return new Response(null, { status: 304 });
    }
    return handleAnything(searchParams, req);
  }
  // /cache/{seconds}
  // Cache for a specified number of seconds. Maximum is 3600 seconds.
  const seconds = Math.min(stringToNumber(parts[1]), 3600);
  if (seconds <= 0) {
    throw new CustomError("Cache seconds must be in range [1, 3600]", 400);
  }
  const headers = {
    "Cache-Control": `public, max-age=${seconds}`,
    "Surrogate-Control": `max-age=${seconds}`,
    Expires: new Date(Date.now() + seconds * 1000).toUTCString(),
    "Last-Modified": new Date().toUTCString(),
    ETag: `"${seconds}"`,
  };
  return handleAnything(searchParams, req, { respHeaders: headers });
}

async function handleAnything(
  searchParams,
  req,
  { respHeaders = {}, extra = {}, status = 200 } = {},
) {
  if (status < 200 || status > 599) {
    throw new CustomError("Status code must be in range [200, 599]", 400);
  }
  const body = {
    args: objectFromPairs(searchParams),
    headers: Object.fromEntries(req.headers),
    ip_geo: extractIp(req),
    url: req.url,
    method: req.method,
    ...extra,
  };
  if (searchParams.get("raw") === "1") {
    Object.assign(body, { cf: req.cf || {} });
    body["raw_body"] = await req.text();
  } else {
    Object.assign(body, await readRequestBody(req));
  }

  respHeaders["Content-Type"] = "application/json; charset=utf-8";
  return new Response(JSON.stringify(body, null, 2), {
    headers: respHeaders,
    status,
  });
}

async function readRequestBody(request) {
  const contentType =
    request.headers.get("content-type") || "application/octet-stream";
  if (contentType.includes("application/json")) {
    return { json: await request.json() };
  } else if (contentType.includes("text")) {
    return { data: request.text() };
  } else if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    const forms = {};
    const files = {};
    for (const [key, value] of formData) {
      if (value instanceof File) {
        const body = {
          size: value.size,
          type: value.type,
          name: value.name,
        };
        if (value.type.includes("text")) {
          body["content"] = await value.text();
        } else {
          const arrayBuffer = await value.arrayBuffer();
          const base64String = arrayBufferToBase64(arrayBuffer);
          const dataUrl = `data:${value.type};base64,${base64String}`;
          body["content"] = dataUrl;
        }
        files[key] = body;
      } else {
        forms[key] = value;
      }
    }
    return { form: forms, files: files };
  } else {
    // Perhaps some other type of data was submitted in the form
    // like an image, or some other binary data.
    const arrayBuffer = await request.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return {};
    }
    const base64String = arrayBufferToBase64(arrayBuffer);
    const dataUrl = `data:${contentType};base64,${base64String}`;
    return { data: dataUrl };
  }
}
