import { env } from "./env";

const BASE = "https://api.edinet-fsa.go.jp/api/v2";

export type EdinetDoc = {
  docID: string;
  edinetCode: string | null;
  secCode: string | null;
  filerName: string | null;
  docDescription: string | null;
  docTypeCode: string | null;
  formCode: string | null;
  ordinanceCode: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  submitDateTime: string | null;
};

type DocListResponse = {
  metadata?: { status?: string; message?: string };
  results?: EdinetDoc[];
};

async function fetchWithRetry(
  url: string,
  context: string,
  maxAttempts = 4
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      // 一時的なエラーはリトライ
      if (res.status === 429 || res.status >= 500) {
        const wait = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s, 8s
        if (attempt < maxAttempts) {
          await sleep(wait);
          continue;
        }
        throw new Error(`${context}: HTTP ${res.status} after ${attempt} attempts`);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${context}: ${String(lastErr)}`);
}

export async function fetchDocList(date: string): Promise<EdinetDoc[]> {
  const url = `${BASE}/documents.json?date=${date}&type=2&Subscription-Key=${env.EDINET_API_KEY}`;
  const res = await fetchWithRetry(url, `EDINET docList ${date}`);
  if (!res.ok) throw new Error(`EDINET docList ${date}: HTTP ${res.status}`);
  const json = (await res.json()) as DocListResponse;
  return json.results ?? [];
}

export async function fetchDocBinary(
  docID: string,
  type: 1 | 5
): Promise<Buffer> {
  const url = `${BASE}/documents/${docID}?type=${type}&Subscription-Key=${env.EDINET_API_KEY}`;
  const res = await fetchWithRetry(url, `EDINET doc ${docID} type=${type}`);
  if (!res.ok) throw new Error(`EDINET doc ${docID} type=${type}: HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Iterate dates inclusive
export function* dateRange(startISO: string, endISO: string): Generator<string> {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
