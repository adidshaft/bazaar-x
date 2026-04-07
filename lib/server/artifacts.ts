import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ARTIFACT_DIR } from "./config";
import { toPrettyJson, jsonClone } from "./json";

export function artifactPath(relativePath: string) {
  return resolve(/* turbopackIgnore: true */ process.cwd(), ARTIFACT_DIR, relativePath);
}

export async function writeArtifact(relativePath: string, data: unknown) {
  const absolutePath = artifactPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, toPrettyJson(data));
  return absolutePath;
}

export async function readArtifact<T>(relativePath: string): Promise<T | null> {
  const absolutePath = artifactPath(relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }

  const raw = readFileSync(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeArtifactSnapshot<T extends object>(relativePath: string, data: T) {
  const payload = jsonClone({
    ...data,
    savedAt: new Date().toISOString(),
  });

  const path = await writeArtifact(relativePath, payload);
  return { path, payload };
}
