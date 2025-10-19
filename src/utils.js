export class CustomError extends Error {
  /**
   * @param {string} message - 错误信息
   * @param {number|string} code - 自定义的错误代码 (例如 HTTP 状态码或内部代码)
   */
  constructor(message, code) {
    // 必须调用 super() 来正确初始化 Error 对象
    super(message);

    // 设置原型链的名称，有助于调试 (可选)
    this.name = "CustomError";

    // 添加自定义的 code 属性
    this.code = code;

    // 修复 V8 引擎中 instanceof 的问题 (可选，但推荐)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
  }
}

/**
 * 将 ArrayBuffer 转换为 Base64 字符串
 * @param {ArrayBuffer} buffer - 文件的 ArrayBuffer 数据
 * @returns {string} Base64 字符串
 */
export function arrayBufferToBase64(buffer) {
  // 1. 将 ArrayBuffer 转换为 Uint8Array
  const bytes = new Uint8Array(buffer);
  let binary = "";

  // 2. 遍历字节，转换为二进制字符串
  // Worker 环境没有标准的 Buffer.from()，需要使用 atob/btoa 的变通方法
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  // 3. 使用 btoa 进行 Base64 编码
  // 注意：btoa 仅适用于 ASCII 字符串，但对于 ArrayBuffer 转换而来的二进制字符串是有效的。
  return btoa(binary);
}

// Strictly convert a string to a number, throwing an error if conversion fails
export function stringToNumber(str) {
  const num = Number(str); // Attempt to convert the string to a number

  // Check if the result is NaN (Not-a-Number)
  // Number.isNaN() is preferred over global isNaN() as it doesn't coerce the value to a number first.
  if (Number.isNaN(num)) {
    throw new CustomError(
      `Invalid input: "${str}" cannot be converted to a number.`,
      400,
    );
  }
  return num;
}

export function getDateString({
  timeZone = "Asia/Shanghai",
  format = "iso", // "iso" or "locale" or "ts" or "utc"
  locale = "en-GB",
}) {
  switch (format) {
    case "ts":
    case "timestamp":
      return Date.now();
    case "locale":
      return new Date().toLocaleString(locale, { timeZone });
    case "utc":
      return new Date().toUTCString();
    case "iso":
    default:
      return new Date().toISOString();
  }
}

export function extractIp(req) {
  // https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties
  const cf = req.cf || {};
  return {
    origin:
      req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for"),
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
  };
}

/// Convert an array of key-value pairs into an object.
/// If a key appears multiple times, its values are collected into an array.
/// E.g. [['a', 1], ['b', 2], ['a', 3]] => { a: [1, 3], b: 2 }
export function objectFromPairs(pairs) {
  const object = {};
  for (const [key, value] of pairs) {
    if (object.hasOwnProperty(key)) {
      // If the key already exists, we need to create or append to an array.
      if (!Array.isArray(object[key])) {
        object[key] = [object[key]]; // Convert the existing value to an array
      }
      object[key].push(value);
    } else {
      // If the key doesn't exist, just set the value.
      object[key] = value;
    }
  }
  return object;
}

export async function sleep(seconds) {
  await new Promise((resolve) =>
    setTimeout(resolve, Math.min(seconds, 10) * 1000),
  );
}

export async function getTextInput(req, searchParams) {
  const url = searchParams.get("url");
  if (url) {
    const reqHeaders = new Headers(req.headers);
    const resp = await fetch(url, {
      redirect: "follow",
      headers: reqHeaders,
    });
    if (!resp.ok) {
      throw new CustomError(`Failed to fetch URL: ${url}`, resp.status);
    }
    if (!resp.headers.get("Content-Type")?.includes("text")) {
      throw new CustomError(
        `URL does not point to a text resource: ${url}`,
        400,
      );
    }
    return await resp.text();
  }
  const text = (await req.text()) || searchParams.get("text");
  if (text) return text;

  throw new CustomError("No input provided", 400);
}
