import { isValidFullName, parseFullName } from "../utils/naming";
import { isValidSemVer } from "../utils/semver";
import { generateId } from "../utils/response";

export interface PublishInput {
  manifest: Record<string, unknown>;
  manifestText: string;
  archiveData: ArrayBuffer | null;
  userId: string;
}

export interface PublishValidation {
  valid: boolean;
  errors: string[];
  parsed?: {
    fullName: string;
    scope: string;
    name: string;
    version: string;
    type: string;
    description: string;
  };
}

export function validatePublishInput(input: PublishInput): PublishValidation {
  const errors: string[] = [];
  const m = input.manifest;

  const fullName = m.name as string;
  const version = m.version as string;
  const type_ = m.type as string;
  const description = (m.description as string) ?? "";

  if (!fullName || !isValidFullName(fullName)) {
    errors.push(`Invalid package name: ${fullName}`);
  }
  if (!version || !isValidSemVer(version)) {
    errors.push(`Invalid version: ${version}`);
  }
  if (!["skill", "mcp", "cli"].includes(type_)) {
    errors.push(`Invalid type: ${type_}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const parsed = parseFullName(fullName)!;
  return {
    valid: true,
    errors: [],
    parsed: {
      fullName,
      scope: parsed.scope,
      name: parsed.name,
      version,
      type: type_,
      description,
    },
  };
}

export async function computeSHA256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
