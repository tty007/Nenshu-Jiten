"use server";

import { listAuthorsForSelector } from "./get-authors";

/**
 * クライアント（AuthorSelector）から呼ばれる軽量な公開著者リスト取得。
 * server-only な lib/admin/articles/get-authors.ts のラッパー。
 */
export async function listAuthorsForSelectorClient() {
  return await listAuthorsForSelector();
}
