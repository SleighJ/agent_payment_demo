/**
 * Database connection and initialization using sql.js
 * (Pure JavaScript SQLite - no native compilation needed)
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { CREATE_TABLES_SQL } from './schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Database');

let db: SqlJsDatabase | null = null;
let dbPath: string = './data/agent-payments.db';

/**
 * Get the database instance (singleton)
 */
export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Initialize the database connection and create tables
 */
export async function initDb(path?: string): Promise<SqlJsDatabase> {
  dbPath = path || process.env.DATABASE_PATH || './data/agent-payments.db';
  
  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info('Created database directory', { dir });
  }

  logger.info('Initializing database', { path: dbPath });
  
  // Initialize SQL.js
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    logger.info('Loaded existing database');
  } else {
    db = new SQL.Database();
    logger.info('Created new database');
  }
  
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');
  
  // Create tables
  db.run(CREATE_TABLES_SQL);
  
  // Save database
  saveDb();
  
  logger.info('Database initialized successfully');
  
  return db;
}

/**
 * Save the database to disk
 */
export function saveDb(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
}

/**
 * Close the database connection
 */
export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Run a query and return all results
 */
export function query<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const database = getDb();
  const stmt = database.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as T;
    results.push(row);
  }
  stmt.free();
  
  return results;
}

/**
 * Run a query and return the first result
 */
export function queryOne<T>(sql: string, params: (string | number | null)[] = []): T | undefined {
  const results = query<T>(sql, params);
  return results[0];
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 */
export function execute(sql: string, params: (string | number | null)[] = []): void {
  const database = getDb();
  database.run(sql, params);
  saveDb();
}

/**
 * Get the last inserted row ID
 */
export function lastInsertRowId(): number {
  const database = getDb();
  const result = database.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0]?.[0] as number || 0;
}

/**
 * Run a transaction with automatic rollback on error
 */
export function runTransaction<T>(fn: () => T): T {
  const database = getDb();
  database.run('BEGIN TRANSACTION');
  
  try {
    const result = fn();
    database.run('COMMIT');
    saveDb();
    return result;
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
}
