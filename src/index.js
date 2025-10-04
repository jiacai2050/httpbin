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
      return new Response(`<h1>${err.message}</h1><p>${err.stack}</p>`, {
        status: 500,
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
    case "headers":
      return Response.json(Object.fromEntries(req.headers));
    case "ip":
      return handleIp(req);
    case "user-agent":
      return Response.json({
        "user-agent": req.headers.get("User-Agent") || "unknown",
      });
    case "get":
    case "anything":
      return handleAnything(searchParams, req);
    case "delay": {
      const delay = Math.min(parseInt(searchParams.get("seconds")) || 1, 10);
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      return Response.json({
        delay: delay,
      });
    }
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
      let count = Math.min(10, stringToNumber(parts[1]));
      count -= 1;
      const location = count === 0 ? "/get" : `/redirect/${count}`;
      return Response.redirect(new URL(location, req.url), 302);
    }
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
    case "status": {
      if (parts.length === 1) {
        throw new CustomError("Status code is required", 400);
      }
      const code = stringToNumber(parts[1]);
      return Response.json({ code: code }, { status: code });
    }
  }

  return Response.json(
    { error: `'${req.url}' not found`, pathname },
    { status: 404 },
  );
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

async function handleAnything(searchParams, req) {
  const ret = {
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
    return Response.json(ret);
  }

  const bodyObj = await readRequestBody(req);
  Object.assign(ret, bodyObj);
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
