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
