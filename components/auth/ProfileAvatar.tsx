"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * モバイル右上のプロフィールアバター。
 *
 *  - /mypage/* に居て、かつモバイル幅 (lg 未満) のとき：
 *    タップでマイページのサイドドロワーを開閉する
 *    （window に "mypage-menu-toggle" カスタムイベントを発火）
 *  - それ以外：通常通り /mypage に遷移
 *
 * MypageNav 側がイベントを listen してドロワー開閉する。
 */
export function ProfileAvatar({
  initial,
  label,
}: {
  initial: string;
  label: string;
}) {
  const pathname = usePathname();
  const isOnMypage = pathname?.startsWith("/mypage") ?? false;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      isOnMypage &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("mypage-menu-toggle"));
    }
  };

  return (
    <Link
      href="/mypage"
      onClick={handleClick}
      aria-label={
        isOnMypage ? "マイページメニューを開閉" : `マイページ (${label})`
      }
      className="inline-flex items-center"
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white"
      >
        {initial}
      </span>
    </Link>
  );
}
