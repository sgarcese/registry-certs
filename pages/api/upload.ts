import { NextApiRequest, NextApiResponse } from 'next';
import Busboy from 'busboy';

import { getAppServices } from '../../server/lib/app-services';
import { AnnotatedFilePart } from '../../server/util';
import { UploadResponse } from '../../lib/upload-types';

export const config = {
  api: {
    // busboy consumes the multipart stream directly.
    bodyParser: false,
  },
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

interface ParsedUpload {
  fields: { [name: string]: string };
  file: AnnotatedFilePart | null;
}

function parseMultipart(req: NextApiRequest): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    });

    const out: ParsedUpload = { fields: {}, file: null };

    busboy.on('field', (name, value) => {
      out.fields[name] = value;
    });

    busboy.on('file', (_name, stream, info) => {
      const chunks: Buffer[] = [];

      stream.on('data', chunk => chunks.push(chunk));
      stream.on('limit', () =>
        reject(new Error('Upload exceeds the 10MB limit'))
      );
      stream.on('end', () => {
        out.file = {
          filename: info.filename,
          headers: { 'content-type': info.mimeType },
          payload: Buffer.concat(chunks),
        };
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => resolve(out));

    req.pipe(busboy);
  });
}

/**
 * Multipart upload of supporting documents for birth/marriage certificate
 * requests (exposed externally as /upload via a rewrite). The attachment is
 * stored through Commerce attachment stored procedures, keyed by the
 * client-generated uploadSessionId.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | { message: string }>
) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const services = await getAppServices();

  try {
    const { fields, file } = await parseMultipart(req);
    const { type, label, uploadSessionId } = fields;

    if (type === 'DC') {
      res.status(422).json({
        message:
          'Can only upload attachments for birth or marriage certificates',
      });
      return;
    }

    if (!uploadSessionId) {
      res.status(422).json({ message: 'No uploadSessionId provided' });
      return;
    }

    if (!file) {
      res.status(422).json({ message: 'No file provided' });
      return;
    }

    const db = services.registryDbFactory.registryDb();

    const attachmentKey = await db.uploadFileAttachment(
      type as any,
      uploadSessionId,
      label || null,
      file
    );

    res.status(200).json({
      attachmentKey,
      filename: file.filename,
    });
  } catch (e) {
    services.rollbar.error(e as any, req);
    res.status(500).json({ message: (e as Error).message });
  }
}
