// @ts-nocheck
import mysql from "mysql2/promise";
import { env } from "./env.js";

export const dbPool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function pingDb() {
  const connection = await dbPool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

async function ensureUniqueIndex(connection, indexName, ddl) {
  try {
    await connection.query(ddl);
  } catch (err) {
    const message = String(err?.message ?? "");
    if (message.includes("Duplicate key name") && message.includes(indexName)) {
      return;
    }
    throw err;
  }
}

async function ensureColumn(connection, tableName, columnName, columnDefSql) {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  if (Array.isArray(rows) && rows.length > 0) return;
  await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefSql}`);
}

export async function ensureUserSchema() {
  const connection = await dbPool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        uid VARCHAR(32) NULL,
        name VARCHAR(64) NOT NULL,
        email VARCHAR(191) NULL,
        avatar_url VARCHAR(255) NULL,
        profile_cover_url VARCHAR(512) NULL,
        bio TEXT NULL,
        ai_model_id VARCHAR(64) NULL,
        submission_analysis_mode VARCHAR(16) NOT NULL DEFAULT 'wrong_only',
        autosave_interval_seconds INT NOT NULL DEFAULT 30,
        oauth_provider VARCHAR(32) NULL,
        oauth_subject VARCHAR(191) NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        is_banned TINYINT(1) NOT NULL DEFAULT 0,
        records_public TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    await ensureColumn(connection, "users", "uid", "VARCHAR(32) NULL");
    await ensureColumn(connection, "users", "email", "VARCHAR(191) NULL");
    await ensureColumn(connection, "users", "avatar_url", "VARCHAR(255) NULL");
    await ensureColumn(connection, "users", "profile_cover_url", "VARCHAR(512) NULL");
    await ensureColumn(connection, "users", "bio", "TEXT NULL");
    await ensureColumn(connection, "users", "ai_model_id", "VARCHAR(64) NULL");
    await ensureColumn(connection, "users", "submission_analysis_mode", "VARCHAR(16) NOT NULL DEFAULT 'wrong_only'");
    await ensureColumn(connection, "users", "autosave_interval_seconds", "INT NOT NULL DEFAULT 30");
    await ensureColumn(connection, "users", "oauth_provider", "VARCHAR(32) NULL");
    await ensureColumn(connection, "users", "oauth_subject", "VARCHAR(191) NULL");
    await ensureColumn(connection, "users", "is_admin", "TINYINT(1) NOT NULL DEFAULT 0");
    await ensureColumn(connection, "users", "is_banned", "TINYINT(1) NOT NULL DEFAULT 0");
    await ensureColumn(connection, "users", "records_public", "TINYINT(1) NOT NULL DEFAULT 1");
    await ensureColumn(connection, "users", "highlighter_enabled", "TINYINT(1) NOT NULL DEFAULT 1");
    await ensureColumn(connection, "users", "last_data_export_at", "DATETIME NULL");
    await connection.query("ALTER TABLE users MODIFY COLUMN submission_analysis_mode VARCHAR(16) NOT NULL DEFAULT 'wrong_only'");
    await connection.query("ALTER TABLE users MODIFY COLUMN records_public TINYINT(1) NOT NULL DEFAULT 1");

    await connection.query("UPDATE users SET uid = CONCAT('pre', id) WHERE uid IS NULL OR uid = ''");
    await connection.query(
      "UPDATE users SET autosave_interval_seconds = 30 WHERE autosave_interval_seconds NOT IN (0, 30, 60, 120, 300, 600)"
    );

    await ensureUniqueIndex(connection, "users_email_unique", "CREATE UNIQUE INDEX users_email_unique ON users (email)");
    await ensureUniqueIndex(connection, "users_uid_unique", "CREATE UNIQUE INDEX users_uid_unique ON users (uid)");
    await ensureUniqueIndex(
      connection,
      "users_oauth_unique",
      "CREATE UNIQUE INDEX users_oauth_unique ON users (oauth_provider, oauth_subject)"
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        \`key\` VARCHAR(64) NOT NULL,
        \`value\` TEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`key\`)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_pages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        system_key VARCHAR(32) NULL,
        slug VARCHAR(64) NOT NULL,
        title VARCHAR(191) NOT NULL,
        content LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_system_pages_slug (slug),
        UNIQUE KEY uq_system_pages_system_key (system_key)
      )
    `);
    await ensureColumn(connection, "system_pages", "system_key", "VARCHAR(32) NULL");
    await ensureColumn(connection, "system_pages", "slug", "VARCHAR(64) NOT NULL");
    await ensureColumn(connection, "system_pages", "title", "VARCHAR(191) NOT NULL");
    await ensureColumn(connection, "system_pages", "content", "LONGTEXT NULL");
    await ensureColumn(connection, "system_pages", "created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await ensureColumn(
      connection,
      "system_pages",
      "updated_at",
      "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );
    await connection.query(
      "UPDATE system_pages SET slug = 'user-agreement' WHERE system_key = 'user_agreement' AND slug <> 'user-agreement'"
    );
    await connection.query(
      "UPDATE system_pages SET slug = 'privacy-policy' WHERE system_key = 'privacy_policy' AND slug <> 'privacy-policy'"
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        token CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        created_by_uid VARCHAR(32) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_admin_tokens_token (token)
      )
    `);
    await ensureColumn(connection, "admin_tokens", "token", "CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL");
    await connection.query("ALTER TABLE admin_tokens MODIFY COLUMN token CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL");
    await ensureColumn(connection, "admin_tokens", "created_by_uid", "VARCHAR(32) NULL");
    await ensureColumn(connection, "admin_tokens", "created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_daily (
        user_uid VARCHAR(32) NOT NULL,
        model_id VARCHAR(64) NOT NULL,
        usage_date DATE NOT NULL,
        used_count INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_uid, model_id, usage_date)
      )
    `);
    await ensureColumn(connection, "ai_usage_daily", "user_uid", "VARCHAR(32) NOT NULL");
    await ensureColumn(connection, "ai_usage_daily", "model_id", "VARCHAR(64) NOT NULL");
    await ensureColumn(connection, "ai_usage_daily", "usage_date", "DATE NOT NULL");
    await ensureColumn(connection, "ai_usage_daily", "used_count", "INT NOT NULL DEFAULT 0");
    await ensureColumn(
      connection,
      "ai_usage_daily",
      "updated_at",
      "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS problemsets (
        id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(191) NOT NULL,
        description TEXT NOT NULL,
        duration_minutes INT NOT NULL DEFAULT 120,
        question_config LONGTEXT NULL,
        created_by_uid VARCHAR(32) NULL,
        problemset_type VARCHAR(32) NOT NULL DEFAULT 'official_public',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    await ensureColumn(connection, "problemsets", "question_config", "LONGTEXT NULL");
    await ensureColumn(connection, "problemsets", "problemset_type", "VARCHAR(32) NOT NULL DEFAULT 'official_public'");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        problemset_id BIGINT UNSIGNED NOT NULL,
        question_index INT NOT NULL,
        question_type VARCHAR(16) NOT NULL DEFAULT 'option',
        material_group_index INT NULL,
        group_question_index INT NULL,
        group_question_count INT NULL,
        group_title VARCHAR(191) NULL,
        shared_material MEDIUMTEXT NULL,
        stem TEXT NOT NULL,
        input_placeholder TEXT NULL,
        options_json JSON NOT NULL,
        score DECIMAL(8,2) NOT NULL DEFAULT 1.50,
        answer VARCHAR(64) NOT NULL,
        analysis TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_problem_question (problemset_id, question_index)
      )
    `);
    await ensureColumn(connection, "questions", "question_type", "VARCHAR(16) NOT NULL DEFAULT 'option'");
    await ensureColumn(connection, "questions", "material_group_index", "INT NULL");
    await ensureColumn(connection, "questions", "group_question_index", "INT NULL");
    await ensureColumn(connection, "questions", "group_question_count", "INT NULL");
    await ensureColumn(connection, "questions", "group_title", "VARCHAR(191) NULL");
    await ensureColumn(connection, "questions", "shared_material", "MEDIUMTEXT NULL");
    await ensureColumn(connection, "questions", "input_placeholder", "TEXT NULL");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_uid VARCHAR(32) NOT NULL,
        problemset_id BIGINT UNSIGNED NOT NULL,
        mode VARCHAR(16) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'submitted',
        answers_json LONGTEXT NULL,
        results_json LONGTEXT NULL,
        score DECIMAL(8,2) NOT NULL DEFAULT 0,
        max_score DECIMAL(8,2) NOT NULL DEFAULT 0,
        remaining_seconds INT NULL,
        started_at DATETIME NULL,
        submitted_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_submissions_user_problem (user_uid, problemset_id),
        INDEX idx_submissions_user_status (user_uid, status),
        INDEX idx_submissions_problem (problemset_id)
      )
    `);
    await ensureColumn(connection, "submissions", "answers_json", "LONGTEXT NULL");
    await ensureColumn(connection, "submissions", "results_json", "LONGTEXT NULL");
    await ensureColumn(connection, "submissions", "remaining_seconds", "INT NULL");
    await ensureColumn(connection, "submissions", "started_at", "DATETIME NULL");
    await ensureColumn(connection, "submissions", "submitted_at", "DATETIME NULL");
    await ensureColumn(connection, "submissions", "mode", "VARCHAR(16) NOT NULL DEFAULT 'training'");
    await ensureColumn(connection, "submissions", "status", "VARCHAR(16) NOT NULL DEFAULT 'submitted'");
    await ensureColumn(connection, "submissions", "max_score", "DECIMAL(8,2) NOT NULL DEFAULT 0");
    await ensureUniqueIndex(connection, "idx_submissions_user_problem", "CREATE INDEX idx_submissions_user_problem ON submissions (user_uid, problemset_id)");
    await ensureUniqueIndex(connection, "idx_submissions_user_status", "CREATE INDEX idx_submissions_user_status ON submissions (user_uid, status)");
    await ensureUniqueIndex(connection, "idx_submissions_problem", "CREATE INDEX idx_submissions_problem ON submissions (problemset_id)");
  } finally {
    connection.release();
  }
}
