import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// =====================================================================
// 公開記事ページ・管理プレビューで自動挿入されるフッター。
// 出典・編集方針はテンプレ生成（§4.13）でエディタ本文に挿入する運用に
// 戻したため、本コンポーネントは「著者カード」のみを担う。
// =====================================================================

export type ArticleFooterProps = {
  articleId: string;
  className?: string;
};

type AuthorSummary = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
};

async function loadAuthor(
  articleId: string
): Promise<AuthorSummary | null> {
  const sb = createSupabaseAdminClient();

  const aRes = await sb
    .from("articles")
    .select("author_id")
    .eq("id", articleId)
    .maybeSingle();
  const authorId = (aRes.data?.author_id ?? null) as string | null;
  if (!authorId) return null;

  const auRes = await sb
    .from("article_authors")
    .select("id, slug, name, title, bio, avatar_url, is_active")
    .eq("id", authorId)
    .maybeSingle();
  if (auRes.error || !auRes.data || !auRes.data.is_active) return null;

  return {
    id: auRes.data.id as string,
    slug: auRes.data.slug as string,
    name: auRes.data.name as string,
    title: (auRes.data.title ?? null) as string | null,
    bio: (auRes.data.bio ?? null) as string | null,
    avatar_url: (auRes.data.avatar_url ?? null) as string | null,
  };
}

export async function ArticleFooter({
  articleId,
  className,
}: ArticleFooterProps) {
  const author = await loadAuthor(articleId);
  if (!author) return null;

  return (
    <footer className={`article-footer ${className ?? ""}`}>
      <section className="article-footer__author">
        <h2>著者</h2>

        <div className="article-footer__author-row">
          {author.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatar_url}
              alt={author.name}
              className="article-footer__avatar"
            />
          ) : (
            <div className="article-footer__avatar article-footer__avatar--placeholder">
              {author.name.slice(0, 1)}
            </div>
          )}

          <div className="article-footer__author-body">
            <div className="article-footer__author-name-row">
              <span className="article-footer__author-name">
                {author.name}
              </span>
              {author.title && (
                <>
                  <span
                    className="article-footer__author-slash"
                    aria-hidden
                  >
                    /
                  </span>
                  <span className="article-footer__author-title">
                    {author.title}
                  </span>
                </>
              )}
            </div>
            {author.bio && (
              <p className="article-footer__author-bio">{author.bio}</p>
            )}
          </div>
        </div>
      </section>

      <ArticleFooterStyles />
    </footer>
  );
}

function ArticleFooterStyles() {
  return (
    <style>{`
      .article-footer {
        margin-top: 3rem;
        padding-top: 2rem;
        border-top: 1px solid #e5e7eb;
      }

      .article-footer h2 {
        font-size: 0.78rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        margin: 0 0 1.1rem;
      }

      .article-footer__author-row {
        display: flex;
        align-items: flex-start;
        gap: 1.2rem;
      }
      .article-footer__avatar {
        flex-shrink: 0;
        width: 64px;
        height: 64px;
        border-radius: 9999px;
        object-fit: cover;
        background: #f1f5f9;
      }
      .article-footer__avatar--placeholder {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #93c5fd 0%, #3b82f6 55%, #1d4ed8 100%);
        color: #ffffff;
        font-weight: 700;
        font-size: 1.4rem;
      }

      /* 名前 + "/" + 肩書き：斜めの意匠は唯一ここの "/" だけに集約 */
      .article-footer__author-body {
        flex: 1;
        min-width: 0;
        padding-top: 0.05rem;
      }
      .article-footer__author-name-row {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 0.45rem;
        line-height: 1.4;
      }
      .article-footer__author-name {
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.005em;
      }
      .article-footer__author-slash {
        display: inline-block;
        font-family: ui-serif, Georgia, "Times New Roman", serif;
        font-style: italic;
        font-weight: 700;
        font-size: 1.25em;
        line-height: 0.85;
        background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #60a5fa 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        transform: translateY(-1px);
      }
      .article-footer__author-title {
        font-size: 0.85rem;
        font-weight: 500;
        color: #475569;
      }

      .article-footer__author-bio {
        margin: 0.55rem 0 0;
        font-size: 0.9rem;
        line-height: 1.95;
        color: #334155;
      }
    `}</style>
  );
}
