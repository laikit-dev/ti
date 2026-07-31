import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config as loadDotenv } from 'dotenv';

const CONTENT_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8',
};

// Load .env from repo root
loadDotenv({ quiet: true });

function parseBoolean(value) {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizePrefix(prefix) {
    if (!prefix) return '';
    return prefix.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function toPosixPath(filePath) {
    return filePath.split(path.sep).join('/');
}

async function walkFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walkFiles(absolute)));
            continue;
        }
        if (entry.isFile()) {
            files.push(absolute);
        }
    }

    return files;
}

function getCacheControl(remoteKey) {
    const normalized = remoteKey.toLowerCase();

    // Vite hashed assets (JS/CSS/fonts/images in assets/ dir) are immutable
    if (normalized.startsWith('assets/')) {
        return 'public, max-age=31536000, immutable';
    }

    // HTML and JSON should be checked more frequently
    if (normalized.endsWith('.html') || normalized.endsWith('.json')) {
        return 'public, max-age=60';
    }

    return 'public, max-age=3600';
}

function getContentType(remoteKey) {
    const extension = path.posix.extname(remoteKey.toLowerCase());
    return CONTENT_TYPES[extension] || 'application/octet-stream';
}

async function uploadWithConcurrency(items, limit, worker) {
    let index = 0;
    let completed = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const current = index;
            index += 1;
            if (current >= items.length) break;

            await worker(items[current]);
            completed += 1;
            if (completed % 50 === 0 || completed === items.length) {
                console.log(`[s3-upload] Uploaded ${completed}/${items.length}`);
            }
        }
    });

    await Promise.all(workers);
}

/**
 * Try fetching S3 config from the admin API.
 * Requires S3_API_BASE_URL and S3_API_ADMIN_TOKEN env vars.
 * Returns null if not configured or request fails.
 */
async function fetchConfigFromApi() {
    let apiBaseUrl = (process.env.S3_API_BASE_URL || '').trim();
    const adminToken = (process.env.S3_API_ADMIN_TOKEN || '').trim();

    if (!apiBaseUrl || !adminToken) return null;

    // Auto-prepend http:// if no protocol is present (e.g. "localhost:3000")
    if (!/^https?:\/\//i.test(apiBaseUrl)) {
        apiBaseUrl = `http://${apiBaseUrl}`;
    }

    const url = `${apiBaseUrl.replace(/\/$/, '')}/api/admin/s3/config`;
    console.log(`[s3-upload] Fetching S3 config from admin API: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'x-admin-uid': 'root',
                'x-admin-token': adminToken,
            },
        });

        if (!response.ok) {
            console.warn(`[s3-upload] Admin API returned ${response.status}, falling back to env vars.`);
            return null;
        }

        const data = await response.json();
        if (!data || !data.config) {
            console.warn('[s3-upload] Admin API returned unexpected payload, falling back to env vars.');
            return null;
        }

        const cfg = data.config;
        console.log('[s3-upload] Using S3 config from admin API.');
        return {
            region: String(cfg.region ?? '').trim(),
            bucket: String(cfg.bucket ?? '').trim(),
            accessKeyId: String(cfg.accessKeyId ?? '').trim(),
            secretAccessKey: String(cfg.secretAccessKey ?? '').trim(),
            endpoint: String(cfg.endpoint ?? '').trim(),
            prefix: normalizePrefix(String(cfg.prefix ?? '')),
            forcePathStyle: parseBoolean(String(cfg.forcePathStyle ?? 'true')),
            concurrency: Number.parseInt(String(cfg.concurrency || '8'), 10),
        };
    } catch (err) {
        console.warn(`[s3-upload] Failed to fetch config from API: ${err.message}`);
        console.warn('[s3-upload] Falling back to env vars.');
        return null;
    }
}

/**
 * Build S3 config from individual env vars (fallback).
 */
function buildConfigFromEnv() {
    return {
        region: (process.env.S3_REGION || '').trim(),
        bucket: (process.env.S3_BUCKET || '').trim(),
        accessKeyId: (process.env.S3_ACCESS_KEY_ID || '').trim(),
        secretAccessKey: (process.env.S3_SECRET_ACCESS_KEY || '').trim(),
        endpoint: (process.env.S3_ENDPOINT || '').trim(),
        prefix: normalizePrefix((process.env.S3_PREFIX || '').trim()),
        concurrency: Number.parseInt(process.env.S3_UPLOAD_CONCURRENCY || '8', 10),
        forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE || 'true'),
    };
}

async function main() {
    const enabled = parseBoolean(process.env.S3_UPLOAD_ENABLED || '');
    if (!enabled) {
        console.log('[s3-upload] Skipped (S3_UPLOAD_ENABLED is not true).');
        return;
    }

    // 1. Try admin API first
    let config = await fetchConfigFromApi();

    // 2. Fall back to env vars
    if (!config) {
        config = buildConfigFromEnv();
        console.log('[s3-upload] Using S3 config from environment variables.');
    }

    const sessionToken = (process.env.S3_SESSION_TOKEN || '').trim();

    const missing = [];
    if (!config.region) missing.push('S3_REGION');
    if (!config.bucket) missing.push('S3_BUCKET');
    if (!config.accessKeyId) missing.push('S3_ACCESS_KEY_ID');
    if (!config.secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');

    if (missing.length > 0) {
        throw new Error(
            `Missing required S3 config: ${missing.join(', ')}.\n` +
            '  Provide them via admin panel + S3_API_BASE_URL/S3_API_ADMIN_TOKEN, or directly in .env as env vars.',
        );
    }

    const buildDir = path.resolve((process.env.S3_BUILD_DIR || 'web/dist').trim());
    const buildStat = await fs.stat(buildDir).catch(() => null);
    if (!buildStat || !buildStat.isDirectory()) {
        throw new Error(`Build output directory not found: ${buildDir}`);
    }

    const filePaths = await walkFiles(buildDir);
    if (filePaths.length === 0) {
        console.log(`[s3-upload] No files found under ${buildDir}.`);
        return;
    }

    const concurrency = Number.isFinite(config.concurrency)
        ? Math.min(32, Math.max(1, config.concurrency))
        : 8;

    const clientConfig = {
        region: config.region,
        forcePathStyle: config.forcePathStyle || Boolean(config.endpoint),
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    };
    if (config.endpoint) clientConfig.endpoint = config.endpoint;
    if (sessionToken) clientConfig.credentials.sessionToken = sessionToken;

    const client = new S3Client(clientConfig);

    const bucketUrl = config.prefix
        ? `s3://${config.bucket}/${config.prefix}`
        : `s3://${config.bucket}`;

    console.log(
        `[s3-upload] Uploading ${filePaths.length} files from ${buildDir} to ${bucketUrl}`,
    );

    await uploadWithConcurrency(filePaths, concurrency, async (absolutePath) => {
        const relative = toPosixPath(path.relative(buildDir, absolutePath));
        const remoteKey = config.prefix ? `${config.prefix}/${relative}` : relative;

        await client.send(
            new PutObjectCommand({
                Bucket: config.bucket,
                Key: remoteKey,
                Body: createReadStream(absolutePath),
                CacheControl: getCacheControl(remoteKey),
                ContentType: getContentType(remoteKey),
            }),
        );
    });

    console.log('[s3-upload] Upload completed successfully.');
}

main().catch((error) => {
    console.error('[s3-upload] Upload failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
