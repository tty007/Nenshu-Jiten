/**
 * 記事 body_html から目次を抽出し、各見出しに id 属性を付ける。
 * - <h2>/<h3> のみ対象（h1 は記事タイトル想定）
 * - 既に id がある見出しはその id を採用、無ければ "toc-{連番}" を付与
 * - 内側の HTML タグ（<mark>/<strong> など）はテキスト抽出時に除去
 */

export type TocItem = {
  level: 2 | 3;
  text: string;
  id: string;
};

/**
 * 「年代別の推定年収」h2 を境界に body_html を分割。
 * 個別企業の salary 記事で、それ以降のセクションをゲートするために使う。
 * 該当 h2 が見つからない場合は gated は空文字。
 */
export function splitAtGatedSection(html: string): {
  before: string;
  gated: string;
  hasGate: boolean;
} {
  if (!html) return { before: "", gated: "", hasGate: false };
  const re = /<h2(?:\s[^>]*)?>[^<]*?年代別[^<]*?年収[^<]*?<\/h2>/i;
  const match = re.exec(html);
  if (!match) return { before: html, gated: "", hasGate: false };
  const idx = match.index;
  return {
    before: html.slice(0, idx),
    gated: html.slice(idx),
    hasGate: true,
  };
}

export function extractTocAndAddIds(html: string): {
  toc: TocItem[];
  htmlWithIds: string;
} {
  if (!html) return { toc: [], htmlWithIds: "" };
  const headings: TocItem[] = [];
  let counter = 0;
  const updated = html.replace(
    /<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/gi,
    (_match, levelStr: string, attrs: string, inner: string) => {
      const level = Number(levelStr) as 2 | 3;
      const text = inner
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // 既存 id を優先、無ければ採番
      const idMatch = attrs.match(/\sid=("([^"]*)"|'([^']*)'|([^\s>]+))/);
      const existingId = idMatch?.[2] ?? idMatch?.[3] ?? idMatch?.[4] ?? null;
      const id = existingId && existingId.length > 0 ? existingId : `toc-${counter++}`;
      headings.push({ level, text, id });
      let newAttrs = attrs;
      if (idMatch) {
        // 既に id があれば（採用済みなので）そのまま
      } else {
        newAttrs = `${attrs} id="${id}"`;
      }
      return `<h${level}${newAttrs}>${inner}</h${level}>`;
    }
  );
  return { toc: headings, htmlWithIds: updated };
}
