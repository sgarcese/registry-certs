import { ConnectionPool, config as ConnectionPoolConfig } from 'mssql';

/**
 * Inlined from the monorepo's @cityofboston/mssql-common package so the app is
 * self-sufficient.
 */
export interface DatabaseConnectionOptions {
  username: string;
  password: string;
  server: string;
  domain?: string;
  database: string;
  encryption?: boolean;
  multiSubnetFailover?: boolean;
  packetSize?: number;
}

export async function createConnectionPool(
  {
    username,
    password,
    server,
    domain,
    database,
    encryption,
    multiSubnetFailover,
    packetSize,
  }: DatabaseConnectionOptions,
  errorCb: (err: Error) => unknown
): Promise<ConnectionPool> {
  const opts: ConnectionPoolConfig = {
    user: username,
    password,
    server,
    database,
    stream: true,
    pool: {
      min: 0,
      // Keeps the acquisition from looping forever if there's a failure.
      acquireTimeoutMillis: 10000,
    },
    options: {
      encrypt: typeof encryption === 'boolean' ? encryption : true,
      // RDS and local SQL Server containers use certs that aren't in the
      // trust store; encryption is still on.
      trustServerCertificate: true,
      multiSubnetFailover:
        typeof multiSubnetFailover === 'boolean' ? multiSubnetFailover : false,
      packetSize: typeof packetSize === 'number' ? packetSize : 16384,
      requestTimeout: 45000,
    },
  };

  if (domain) {
    opts.domain = domain;
  }

  const pool = new ConnectionPool(opts);
  pool.on('error', errorCb);

  await pool.connect();

  return pool;
}
