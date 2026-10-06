import type * as api from "./api";
import { DecryptionError, decrypt, encrypt } from "./keystore";

export interface Tag {
  id: number;
  content: string;
  color: string;
  /** The name failed to decrypt — shown as such rather than dropping the tag. */
  unreadable?: boolean;
}

export class InvalidTagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTagError";
  }
}

export async function decryptTag(record: api.TagRecord): Promise<Tag> {
  try {
    return {
      id: record.id,
      content: await decrypt(record.content),
      color: record.color,
    };
  } catch (caught) {
    if (!(caught instanceof DecryptionError)) throw caught;
    return {
      id: record.id,
      content: "",
      color: record.color,
      unreadable: true,
    };
  }
}

/**
 * The only validation this field gets. The server stores ciphertext and can't
 * check it, so this runs before encryption — see entries.ts's `validate`.
 */
export async function encryptTagContent(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) throw new InvalidTagError("Please enter a tag name.");
  return encrypt(trimmed);
}
