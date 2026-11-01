import JSZip from 'jszip';
import { parseProject } from './schema';
import type { Asset, Project } from './schema';

/**
 * Project file format `*.eventflow`: a ZIP archive containing
 *   project.json      – the project with asset metadata (without image data)
 *   assets/<id>.<ext> – the images as binary files
 * This keeps the JSON diff-friendly (e.g. for Git) and the images in their original format.
 */

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function splitDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const [, mime, isBase64, payload] = m;
  const base64 = isBase64 ? payload : btoa(unescape(encodeURIComponent(decodeURIComponent(payload))));
  return { mime, base64 };
}

export async function projectToZip(project: Project): Promise<Uint8Array> {
  const zip = new JSZip();
  const assets: Record<string, Asset> = {};
  for (const asset of Object.values(project.assets)) {
    const parsed = splitDataUrl(asset.dataUrl);
    if (!parsed) continue;
    const file = `assets/${asset.id}.${EXTENSIONS[parsed.mime] ?? 'bin'}`;
    zip.file(file, parsed.base64, { base64: true });
    assets[asset.id] = { ...asset, dataUrl: '', file };
  }
  zip.file('project.json', JSON.stringify({ ...project, assets }, null, 2));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function projectFromZip(data: Uint8Array | ArrayBuffer | Blob): Promise<Project> {
  const zip = await JSZip.loadAsync(data);
  const json = await zip.file('project.json')?.async('string');
  if (!json) throw new Error('Ungültige EventFlow-Datei: project.json fehlt');
  const project = parseProject(JSON.parse(json));
  for (const asset of Object.values(project.assets)) {
    if (!asset.file) continue;
    const base64 = await zip.file(asset.file)?.async('base64');
    if (base64) asset.dataUrl = `data:${asset.mime};base64,${base64}`;
    delete asset.file;
  }
  return project;
}
