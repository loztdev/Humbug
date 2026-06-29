import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import type { Attachment, Message } from '@/types';
import type { ImagePart, ProviderChatMessage } from '@/providers';
import { newId } from '@/utils/id';

/**
 * File uploads. Documents are picked, copied into app storage, and — for
 * text-like files — their contents are extracted so they can be injected into
 * the model's context. Images are kept as files and sent inline to vision
 * models at request time (read as base64 on send, not stored in the DB).
 */

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'log', 'xml', 'yaml', 'yml',
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h',
  'cpp', 'cs', 'php', 'sh', 'sql', 'html', 'css', 'toml', 'ini', 'env',
]);

const MAX_TEXT_CHARS = 24_000; // keep extracted context bounded

function isImage(mime?: string): boolean {
  return !!mime && mime.startsWith('image/');
}

function isTextLike(name: string, mime?: string): boolean {
  if (mime && (mime.startsWith('text/') || mime === 'application/json')) return true;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXTENSIONS.has(ext);
}

/**
 * Open the system document picker and turn the result into Attachments.
 * Extracts text from text-like files; leaves images for vision at send time.
 */
export async function pickAttachments(): Promise<Attachment[]> {
  const res = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return [];

  const out: Attachment[] = [];
  for (const asset of res.assets) {
    const att: Attachment = {
      id: newId('att_'),
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      uri: asset.uri,
      sizeBytes: asset.size ?? 0,
    };
    if (isTextLike(asset.name, asset.mimeType)) {
      try {
        const text = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        att.extractedText = text.slice(0, MAX_TEXT_CHARS);
      } catch {
        // Non-fatal: keep the attachment without extracted text.
      }
    }
    out.push(att);
  }
  return out;
}

/** Read an image attachment as base64 for inline sending. */
async function readImagePart(att: Attachment): Promise<ImagePart | null> {
  try {
    const dataBase64 = await FileSystem.readAsStringAsync(att.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { mimeType: att.mimeType, dataBase64 };
  } catch {
    return null;
  }
}

/**
 * Convert a stored message into a provider message, folding in attachments:
 * text-file contents are appended to the text, images are read as base64.
 */
export async function toProviderMessage(m: Message): Promise<ProviderChatMessage> {
  const atts = m.attachments ?? [];
  let content = m.content;

  const textAtts = atts.filter((a) => a.extractedText);
  if (textAtts.length) {
    const blocks = textAtts
      .map((a) => `\n\n--- Attached file: ${a.name} ---\n${a.extractedText}`)
      .join('');
    content = `${content}${blocks}`;
  }

  const images: ImagePart[] = [];
  for (const a of atts.filter((x) => isImage(x.mimeType))) {
    const part = await readImagePart(a);
    if (part) images.push(part);
  }

  return {
    role: m.role,
    content,
    ...(images.length ? { images } : {}),
  };
}

export { isImage };
