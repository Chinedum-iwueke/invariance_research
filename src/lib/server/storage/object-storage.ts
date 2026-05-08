import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createLocalSignedObjectUrl } from "@/lib/server/storage/local-signed-urls";

export type StoredObject = {
  storage_key: string;
  key?: string;
  content_type: string;
  contentType?: string;
  size_bytes: number;
  size?: number;
  checksum_sha256: string;
  checksum?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ObjectStorageProvider = "local" | "s3" | "r2";
export type ObjectStorageMetadata = {
  contentType?: string;
  size?: number;
  checksum?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ObjectStoragePutInput = {
  bucket: "uploads" | "exports" | "analysis-artifacts" | "reports" | "publications" | "publication-covers";
  file_name: string;
  content_type: string;
  bytes: Uint8Array;
  storage_key?: string;
};

export interface ObjectStorage {
  putObject(input: ObjectStoragePutInput): Promise<StoredObject>;
  getObject(storageKey: string): Promise<Uint8Array>;
  deleteObject(storageKey: string): Promise<void>;
  objectExists(storageKey: string): Promise<boolean>;
  getSignedReadUrl?(storageKey: string, options?: { expiresInSeconds?: number; fileName?: string; contentType?: string }): Promise<string>;
  getSignedWriteUrl?(input: { storageKey: string; contentType?: string; expiresInSeconds?: number }): Promise<string>;
  listObjects?(prefix: string): Promise<Array<{ storage_key: string; metadata?: ObjectStorageMetadata }>>;
  listByPrefix?(prefix: string): Promise<Array<{ storage_key: string; metadata?: ObjectStorageMetadata }>>;
  resolvePublicUrl?(storageKey: string): string | undefined;
}

const ROOT = process.env.INVARIANCE_STORAGE_ROOT ?? path.join(process.cwd(), ".data", "storage");
const require = createRequire(import.meta.url);

let storage: ObjectStorage | undefined;

function resolvePath(storageKey: string) {
  return path.join(ROOT, storageKey);
}

function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function normalizeStoredObject(input: {
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt?: string;
  updatedAt?: string;
}): StoredObject {
  return {
    storage_key: input.storageKey,
    key: input.storageKey,
    content_type: input.contentType,
    contentType: input.contentType,
    size_bytes: input.sizeBytes,
    size: input.sizeBytes,
    checksum_sha256: input.checksumSha256,
    checksum: input.checksumSha256,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

const localObjectStorage: ObjectStorage = {
  async putObject(input) {
    const storageKey = input.storage_key ?? `${input.bucket}/${input.file_name}`;
    const targetPath = resolvePath(storageKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, Buffer.from(input.bytes));
    const now = new Date().toISOString();
    const digest = checksum(input.bytes);
    return normalizeStoredObject({
      storageKey,
      contentType: input.content_type,
      sizeBytes: input.bytes.byteLength,
      checksumSha256: digest,
      createdAt: now,
      updatedAt: now,
    });
  },
  async getObject(storageKey) {
    return new Uint8Array(await fs.readFile(resolvePath(storageKey)));
  },
  async deleteObject(storageKey) {
    await fs.rm(resolvePath(storageKey), { force: true });
  },
  async objectExists(storageKey) {
    try {
      await fs.access(resolvePath(storageKey));
      return true;
    } catch {
      return false;
    }
  },
  async getSignedReadUrl(storageKey, options) {
    return createLocalSignedObjectUrl({
      storageKey,
      expiresAt: Date.now() + (options?.expiresInSeconds ?? 300) * 1000,
      fileName: options?.fileName,
      contentType: options?.contentType,
    });
  },
  async getSignedWriteUrl() {
    throw new Error("Local object storage does not issue signed write URLs.");
  },
  async listObjects(prefix) {
    const root = resolvePath(prefix);
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) return [];
    } catch {
      return [];
    }

    const out: Array<{ storage_key: string; metadata?: ObjectStorageMetadata }> = [];
    const visit = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await visit(absolute);
          continue;
        }
        if (entry.isFile()) {
          const stat = await fs.stat(absolute);
          out.push({
            storage_key: path.relative(ROOT, absolute),
            metadata: {
              size: stat.size,
              createdAt: stat.birthtime.toISOString(),
              updatedAt: stat.mtime.toISOString(),
            },
          });
        }
      }
    };

    await visit(root);
    return out;
  },
  async listByPrefix(prefix) {
    return this.listObjects?.(prefix) ?? [];
  },
  resolvePublicUrl(storageKey) {
    const base = process.env.OBJECT_STORAGE_PUBLIC_BASE_URL;
    return base ? `${base.replace(/\/$/, "")}/${storageKey.replace(/^\//, "")}` : undefined;
  },
};

type S3Dependencies = {
  S3Client: new (config: Record<string, unknown>) => S3ClientLike;
  PutObjectCommand: new (input: Record<string, unknown>) => CommandLike;
  GetObjectCommand: new (input: Record<string, unknown>) => CommandLike;
  DeleteObjectCommand: new (input: Record<string, unknown>) => CommandLike;
  HeadObjectCommand: new (input: Record<string, unknown>) => CommandLike;
  ListObjectsV2Command: new (input: Record<string, unknown>) => CommandLike;
  getSignedUrl: (client: S3ClientLike, command: CommandLike, options: { expiresIn: number }) => Promise<string>;
};

type CommandLike = object;
type S3ClientLike = {
  send(command: object): Promise<Record<string, unknown>>;
};

function loadS3Dependencies(): S3Dependencies {
  try {
    const client = require("@aws-sdk/client-s3");
    const presigner = require("@aws-sdk/s3-request-presigner");
    return {
      S3Client: client.S3Client,
      PutObjectCommand: client.PutObjectCommand,
      GetObjectCommand: client.GetObjectCommand,
      DeleteObjectCommand: client.DeleteObjectCommand,
      HeadObjectCommand: client.HeadObjectCommand,
      ListObjectsV2Command: client.ListObjectsV2Command,
      getSignedUrl: presigner.getSignedUrl,
    };
  } catch {
    throw new Error("S3/R2 object storage requires '@aws-sdk/client-s3' and '@aws-sdk/s3-request-presigner'.");
  }
}

async function streamToBytes(body: unknown) {
  if (!body) return new Uint8Array();
  if (body instanceof Uint8Array) return body;
  if (Buffer.isBuffer(body)) return new Uint8Array(body);
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    return (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  }
  if (typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return new Uint8Array(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
  }
  throw new Error("Unsupported S3 response body type.");
}

export type S3CompatibleObjectStorageConfig = {
  provider: Extract<ObjectStorageProvider, "s3" | "r2">;
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
  forcePathStyle?: boolean;
};

export class S3CompatibleObjectStorage implements ObjectStorage {
  private readonly deps = loadS3Dependencies();
  private readonly client: S3ClientLike;

  constructor(private readonly config: S3CompatibleObjectStorageConfig) {
    this.client = new this.deps.S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
    });
  }

  async putObject(input: ObjectStoragePutInput): Promise<StoredObject> {
    const storageKey = input.storage_key ?? `${input.bucket}/${input.file_name}`;
    const digest = checksum(input.bytes);
    await this.client.send(
      new this.deps.PutObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        Body: Buffer.from(input.bytes),
        ContentType: input.content_type,
        ChecksumSHA256: Buffer.from(digest, "hex").toString("base64"),
      }),
    );
    const now = new Date().toISOString();
    return normalizeStoredObject({
      storageKey,
      contentType: input.content_type,
      sizeBytes: input.bytes.byteLength,
      checksumSha256: digest,
      createdAt: now,
      updatedAt: now,
    });
  }

  async getObject(storageKey: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new this.deps.GetObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
      }),
    );
    return streamToBytes(result.Body);
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.client.send(
      new this.deps.DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
      }),
    );
  }

  async objectExists(storageKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new this.deps.HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: storageKey,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getSignedReadUrl(storageKey: string, options?: { expiresInSeconds?: number; fileName?: string; contentType?: string }): Promise<string> {
    return this.deps.getSignedUrl(
      this.client,
      new this.deps.GetObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        ResponseContentType: options?.contentType,
        ResponseContentDisposition: options?.fileName ? `attachment; filename="${options.fileName}"` : undefined,
      }),
      { expiresIn: options?.expiresInSeconds ?? 300 },
    );
  }

  async getSignedWriteUrl(input: { storageKey: string; contentType?: string; expiresInSeconds?: number }): Promise<string> {
    return this.deps.getSignedUrl(
      this.client,
      new this.deps.PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.storageKey,
        ContentType: input.contentType,
      }),
      { expiresIn: input.expiresInSeconds ?? 300 },
    );
  }

  async listObjects(prefix: string): Promise<Array<{ storage_key: string; metadata?: ObjectStorageMetadata }>> {
    const result = await this.client.send(
      new this.deps.ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
      }),
    );
    const contents = Array.isArray(result.Contents) ? result.Contents : [];
    return contents.map((item) => ({
      storage_key: String(item.Key ?? ""),
      metadata: {
        size: item.Size === undefined ? undefined : Number(item.Size),
        updatedAt: item.LastModified instanceof Date ? item.LastModified.toISOString() : undefined,
      },
    }));
  }

  async listByPrefix(prefix: string) {
    return this.listObjects(prefix);
  }

  resolvePublicUrl(storageKey: string) {
    return this.config.publicBaseUrl ? `${this.config.publicBaseUrl.replace(/\/$/, "")}/${storageKey.replace(/^\//, "")}` : undefined;
  }
}

export function getObjectStorageProvider(): ObjectStorageProvider {
  const provider = process.env.OBJECT_STORAGE_PROVIDER ?? "local";
  if (provider !== "local" && provider !== "s3" && provider !== "r2") {
    throw new Error(`Unsupported OBJECT_STORAGE_PROVIDER "${provider}". Expected local, s3, or r2.`);
  }
  return provider;
}

function parseBool(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function createS3CompatibleStorage(provider: Extract<ObjectStorageProvider, "s3" | "r2">) {
  const bucket = process.env.OBJECT_STORAGE_BUCKET;
  if (!bucket) throw new Error("OBJECT_STORAGE_BUCKET is required for S3-compatible object storage.");
  if (provider === "r2" && !process.env.OBJECT_STORAGE_ENDPOINT) {
    throw new Error("OBJECT_STORAGE_ENDPOINT is required for Cloudflare R2.");
  }
  return new S3CompatibleObjectStorage({
    provider,
    bucket,
    region: process.env.OBJECT_STORAGE_REGION,
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    publicBaseUrl: process.env.OBJECT_STORAGE_PUBLIC_BASE_URL,
    forcePathStyle: parseBool(process.env.OBJECT_STORAGE_FORCE_PATH_STYLE, provider === "r2"),
  });
}

export function getObjectStorage() {
  if (storage) return storage;
  const provider = getObjectStorageProvider();
  storage = provider === "local" ? localObjectStorage : createS3CompatibleStorage(provider);
  return storage;
}

export function resetObjectStorageForTests() {
  storage = undefined;
}
