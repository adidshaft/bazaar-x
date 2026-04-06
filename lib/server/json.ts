export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function jsonReplacer(_: string, value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export function toPrettyJson(value: unknown) {
  return JSON.stringify(value, jsonReplacer, 2);
}

export function fromMaybeJson<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
