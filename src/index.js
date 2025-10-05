import { CustomError, arrayBufferToBase64, stringToNumber } from "./utils.js";

export default {
  async fetch(req, env, ctx) {
    try {
      return await handle(req, env, ctx);
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

async function handle(req, env, ctx) {
  const { pathname, searchParams } = new URL(req.url);
  const parts = pathname.split("/");
  if (parts.length > 0 && parts[0] === "") {
    parts.shift();
  }
  // Index page, return static HTML from assets
  if (parts.length == 0 || parts[0] === "") {
    return env.ASSETS.fetch(req);
  }
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
      return Response.json({ code: code }, { status: code });
    }

    // Request inspection: Inspecting the request data
    case "headers":
      return Response.json(Object.fromEntries(req.headers));
    case "ip":
      return handleIp(req);
    case "user-agent":
      return Response.json({
        "user-agent": req.headers.get("User-Agent") || "unknown",
      });

    // Response inspection: Inspecting the response data
    case "response-headers": {
      const headers = {};
      for (const [key, value] of searchParams) {
        headers[key] = value;
      }
      return Response.json(
        { ...Object.fromEntries(req.headers), ...headers },
        { headers },
      );
    }
    case "cache":
      return handleCache(parts, searchParams, req);

    // Response formats: Testing different response formats
    case "encoding":
      return env.ASSETS.fetch(req);
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
      return handleAnything(searchParams, req, headers, { [key]: true });
    }
    case "html":
    case "xml":
    case "json":
      // response.html response.xml response.json
      return env.ASSETS.fetch(new URL(`/response.${parts[0]}`, req.url));
    case "robots.txt":
      return env.ASSETS.fetch(req);
    case "deny":
      return env.ASSETS.fetch(new URL(`/deny.txt`, req.url));

    // Dynamic data: Generating random and dynamic data
    case "delay": {
      if (parts.length === 1) {
        throw new CustomError("Delay seconds is required", 400);
      }
      const delay = Math.min(stringToNumber(parts[1]), 10);
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
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

    // Cookies: Returns the cookies sent in the request
    case "cookies": {
      const cookies = {};
      req.headers
        .get("Cookie")
        ?.split(";")
        .forEach((cookie) => {
          const [name, ...rest] = cookie.split("=");
          cookies[name.trim()] = rest.join("=").trim();
        });
      return Response.json(cookies);
    }

    // Images
    case "image":
      return handleImage(parts, searchParams, req, env);

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
      return Response.redirect(new URL(location, req.url), 302);
    }

    // Anything: Accepts any request data and returns it back in JSON format
    case "anything":
      return handleAnything(searchParams, req);
  }

  return Response.json(
    { error: `'${req.url}' not found`, pathname },
    { status: 404 },
  );
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

function handleImage(parts, searchParams, req, env) {
  let format = "png";
  if (parts.length === 1) {
    const validAccepts = [
      "image/webp",
      "image/svg+xml",
      "image/jpeg",
      "image/png",
      "image/*",
    ];
    const accept = req.headers.get("Accept");
    if (!accept) {
      throw new CustomError(
        `Unsupported Accept header, must be one of ${validAccepts.join(", ")}`,
        406,
      );
    }
    if (validAccepts.includes(accept)) {
      if (accept === "image/*") {
        format = "png";
      } else if (accept === "image/svg+xml") {
        format = "svg";
      } else {
        format = accept.split("/")[1];
      }
    } else {
      throw new CustomError(
        `Unsupported Accept header, must be one of ${validAccepts.join(", ")}`,
        406,
      );
    }
  } else {
    // /image/{format}
    format = parts[1];
  }
  return env.ASSETS.fetch(new URL(`/image.${format}`, req.url));
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
  return handleAnything(searchParams, req, headers);
}

function handleIp(req) {
  // https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties
  const cf = req.cf || {};
  return Response.json({
    origin:
      req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For"),
    continent: cf.continent,
    latitude: cf.latitude,
    longitude: cf.longitude,
    country: cf.country,
    region: cf.region,
    regionCode: cf.regionCode,
    city: cf.city,
    postalCode: cf.postalCode,
    timezone: cf.timezone,
    // ASN of the incoming request,
    asn: cf.asn,
    // The organization which owns the ASN of the incoming request, for example, Google Cloud.
    asOrganization: cf.asOrganization,
    // The three-letter IATA ↗ airport code of the data center that the request hit, for example, "DFW".
    colo: cf.colo,
    // Metro code (DMA) of the incoming request, for example, "635".
    metroCode: cf.metroCode,
  });
}

async function handleAnything(searchParams, req, respHeaders = {}, extra = {}) {
  const ret = {
    ...extra,
    args: Object.fromEntries(searchParams),
    headers: Object.fromEntries(req.headers),
    origin:
      req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For"),
    url: req.url,
    method: req.method,
  };
  if (searchParams.get("raw") === "1") {
    const cf = req.cf || {};
    Object.assign(ret, { cf });
    ret["body"] = await req.text();
  } else {
    const bodyObj = await readRequestBody(req);
    Object.assign(ret, bodyObj);
  }

  if (Object.keys(respHeaders).length > 0) {
    return Response.json(ret, { headers: respHeaders });
  }
  return Response.json(ret);
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
    console.log("other content-type:", contentType);
    const arrayBuffer = await request.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return {};
    }
    const base64String = arrayBufferToBase64(arrayBuffer);
    const dataUrl = `data:${contentType};base64,${base64String}`;
    return { data: dataUrl };
  }
}
