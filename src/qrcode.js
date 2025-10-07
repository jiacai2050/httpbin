import * as QRCode from "qrcode";
import { CustomError } from "./utils.js";

export async function handleQRCode(userOptions) {
  const options = {
    type: "svg",
    errorCorrectionLevel: "H",
    width: 350,
    text: "Edgebin is awesome!",
    ...userOptions,
  };
  const text = options["text"];
  switch (options["type"]) {
    case "svg": {
      const svg = await QRCode.toString(text, options);
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  throw new CustomError(`Unsupported QR code type: ${options["type"]}`, 400);
}
