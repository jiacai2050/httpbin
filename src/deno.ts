import { serveFile, serveDir } from "jsr:@std/http/file-server";

export function serveFileHandle(req, path) {
  return serveFile(req, path);
}

export function serveDirHandle(req, dir) {
  return serveDir(req, {
    fsRoot: dir,
  });
}
