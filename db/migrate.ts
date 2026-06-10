/* eslint no-console: 0 */

/**
 * Minimal SQL Server migration runner.
 *
 * - Applies db/migrations/*.sql in filename order (V001__..., V002__...).
 * - Splits files on `GO` lines into batches (CREATE PROCEDURE etc. must be
 *   alone in a batch).
 * - Replaces $(APP_DB), $(APP_DB_USER), $(APP_DB_PASSWORD) tokens from env.
 * - Tracks applied migrations in [$(APP_DB)].dbo.SchemaMigrations.
 *
 * Connects with admin credentials (DB_ADMIN_USER / DB_ADMIN_PASSWORD —
 * locally the docker-compose SA user, in AWS the RDS master user from
 * Secrets Manager). The app itself runs as the EXECUTE-only login created in
 * V001.
 *
 * Usage: npm run db:migrate
 */

import fs from 'fs';
import path from 'path';
import { ConnectionPool } from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

const APP_DB = process.env.REGISTRY_DATA_DB_DATABASE || 'RegistryCommerce';
const APP_DB_USER = process.env.REGISTRY_DATA_DB_USER || 'registry_app';
const APP_DB_PASSWORD = process.env.REGISTRY_DATA_DB_PASSWORD || '';

const ADMIN_USER = process.env.DB_ADMIN_USER || 'sa';
const ADMIN_PASSWORD = process.env.DB_ADMIN_PASSWORD || '';
const SERVER = process.env.REGISTRY_DATA_DB_SERVER || 'localhost';

function substituteTokens(sql: string): string {
  if (!APP_DB_PASSWORD) {
    throw new Error(
      'REGISTRY_DATA_DB_PASSWORD must be set (used for the app login created by V001)'
    );
  }

  return sql
    .replace(/\$\(APP_DB\)/g, APP_DB)
    .replace(/\$\(APP_DB_USER\)/g, APP_DB_USER)
    .replace(/\$\(APP_DB_PASSWORD\)/g, APP_DB_PASSWORD.replace(/'/g, "''"));
}

function splitBatches(sql: string): string[] {
  return sql
    .split(/^\s*GO\s*;?\s*$/im)
    .map(b => b.trim())
    .filter(b => b.length > 0);
}

async function main() {
  const pool = new ConnectionPool({
    user: ADMIN_USER,
    password: ADMIN_PASSWORD,
    server: SERVER,
    database: 'master',
    options: {
      encrypt: true,
      trustServerCertificate: true,
      requestTimeout: 120000,
    },
  });

  await pool.connect();

  try {
    // Bootstrap the app DB + tracking table (V001 also creates the DB, but
    // the tracking table must exist before we can check anything).
    await pool
      .request()
      .batch(
        `IF DB_ID(N'${APP_DB}') IS NULL EXEC('CREATE DATABASE [${APP_DB}]');`
      );
    await pool.request().batch(
      `IF OBJECT_ID(N'[${APP_DB}].dbo.SchemaMigrations', N'U') IS NULL
         CREATE TABLE [${APP_DB}].dbo.SchemaMigrations (
           Name NVARCHAR(400) NOT NULL PRIMARY KEY,
           AppliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
         );`
    );

    const applied = new Set<string>(
      (
        await pool
          .request()
          .query(`SELECT Name FROM [${APP_DB}].dbo.SchemaMigrations`)
      ).recordset.map(r => r.Name)
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`= ${file} (already applied)`);
        continue;
      }

      console.log(`> ${file}`);

      const sql = substituteTokens(
        fs.readFileSync(path.resolve(MIGRATIONS_DIR, file), 'utf-8')
      );

      for (const batch of splitBatches(sql)) {
        try {
          await pool.request().batch(batch);
        } catch (e) {
          console.error(`Failed batch in ${file}:\n${batch.slice(0, 400)}`);
          throw e;
        }
      }

      await pool
        .request()
        .input('name', file)
        .query(
          `INSERT INTO [${APP_DB}].dbo.SchemaMigrations (Name) VALUES (@name)`
        );
    }

    console.log('Migrations complete.');
  } finally {
    await pool.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
