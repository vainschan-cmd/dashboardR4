/**
 * Byte-bounded request body readers (`SA-20`).
 *
 * Checking only the `Content-Length` header is trivially bypassed with
 * `Transfer-Encoding: chunked`. Reading from `req.body.getReader()` with a
 * cumulative byte ceiling aborts the stream as soon as the cap is exceeded,
 * protecting V8 heap memory before JSON or multipart parsing runs.
 */

export async function readRequestBufferBounded(
  req: Request,
  maxBytes: number
): Promise<Buffer | null> {
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return null;
  }

  if (!req.body) {
    const ab = await req.arrayBuffer();
    if (ab.byteLength > maxBytes) return null;
    return Buffer.from(ab);
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

export async function readRequestTextBounded(
  req: Request,
  maxBytes: number
): Promise<string | null> {
  const buf = await readRequestBufferBounded(req, maxBytes);
  if (!buf) return null;
  return buf.toString('utf8');
}

export async function readMultipartFormDataBounded(
  req: Request,
  maxBytes: number
): Promise<FormData | null> {
  const contentType = req.headers.get('content-type') || '';
  const buf = await readRequestBufferBounded(req, maxBytes);
  if (!buf) return null;
  return new Response(new Uint8Array(buf), {
    headers: { 'content-type': contentType },
  }).formData();
}
