import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ARTIFACT_DIR, ARTIFACT_SEED_DIR } from "./config";
import { toPrettyJson, jsonClone } from "./json";

export function artifactPath(relativePath: string, baseDir = ARTIFACT_DIR) {
  return resolve(/* turbopackIgnore: true */ process.cwd(), baseDir, relativePath);
}

function artifactLookupPaths(relativePath: string) {
  const candidates = [ARTIFACT_DIR];
  if (ARTIFACT_SEED_DIR && ARTIFACT_SEED_DIR !== ARTIFACT_DIR) {
    candidates.push(ARTIFACT_SEED_DIR);
  }

  return candidates.map((baseDir) => artifactPath(relativePath, baseDir));
}

export async function writeArtifact(relativePath: string, data: unknown) {
  const absolutePath = artifactPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, toPrettyJson(data));
  return absolutePath;
}

export async function readArtifact<T>(relativePath: string): Promise<T | null> {
  for (const absolutePath of artifactLookupPaths(relativePath)) {
    if (!existsSync(absolutePath)) {
      continue;
    }

    const raw = readFileSync(absolutePath, "utf8");
    return JSON.parse(raw) as T;
  }

  return null;
}

export async function writeArtifactSnapshot<T extends object>(relativePath: string, data: T) {
  const payload = jsonClone({
    ...data,
    savedAt: new Date().toISOString(),
  });

  const path = await writeArtifact(relativePath, payload);
  return { path, payload };
}
