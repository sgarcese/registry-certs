/**
 * Absolute path to the root of the app.
 *
 * Runtime file reads (graphql/schema.graphql, server/queries/fulfillment,
 * server/email templates, fixtures) resolve from the process working
 * directory: the repo root in dev/tests, /app in the container (the
 * Dockerfile copies these directories alongside the standalone build, since
 * Next's file tracing can't follow fs.readdir-style dynamic reads).
 */
export const PACKAGE_SRC_ROOT: string = process.cwd();

/**
 * The representation of a multipart file upload (shape kept from hapi's
 * "annotated" output so RegistryDb didn't have to change).
 */
export interface AnnotatedFilePart {
  filename: string;
  headers: Object;
  payload: Buffer;
}
