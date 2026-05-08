"use client";

import { useState } from "react";
import { Eye, Lock, User, UserCog } from "lucide-react";
import {
  MemberOnlyController,
  type MemberForceState,
} from "./MemberOnlyController";
import { cn } from "@/lib/utils";

type Mode = "auto" | MemberForceState;

const OPTIONS: Array<{
  value: Mode;
  label: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    value: "auto",
    label: "自動（自分の状態）",
    desc: "実際のログイン・プロフィール状態で表示",
    icon: <Eye className="h-3.5 w-3.5" />,
  },
  {
    value: "unauth",
    label: "未ログイン",
    desc: "未ログイン読者の見え方（会員登録 CTA）",
    icon: <Lock className="h-3.5 w-3.5" />,
  },
  {
    value: "incomplete",
    label: "ログイン / プロフ未入力",
    desc: "ログイン済だが必須項目未入力（プロフィール CTA）",
    icon: <UserCog className="h-3.5 w-3.5" />,
  },
  {
    value: "complete",
    label: "ログイン / プロフ完了",
    desc: "全文閲覧可（モザイクなし）",
    icon: <User className="h-3.5 w-3.5" />,
  },
];

type Props = { returnTo: string };

export function PreviewMemberStateSwitcher({ returnTo }: Props) {
  const [mode, setMode] = useState<Mode>("auto");
  const forceState: MemberForceState | undefined =
    mode === "auto" ? undefined : mode;
  const current = OPTIONS.find((o) => o.value === mode)!;

  return (
    <>
      <div className="preview-member-switcher">
        <div className="preview-member-switcher__head">
          <span className="preview-member-switcher__label">
            メンバー限定セクションの見え方を切替
          </span>
          <span className="preview-member-switcher__desc">{current.desc}</span>
        </div>
        <div className="preview-member-switcher__buttons">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={cn(
                "preview-member-switcher__btn",
                opt.value === mode && "preview-member-switcher__btn--active"
              )}
              title={opt.desc}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <MemberOnlyController returnTo={returnTo} forceState={forceState} />
      <Styles />
    </>
  );
}

function Styles() {
  return (
    <style>{`
      .preview-member-switcher {
        margin: 1rem 0 1.5rem;
        padding: 0.85rem 1rem;
        border: 1px dashed #cbd5e1;
        background: #f8fafc;
        border-radius: 6px;
      }
      .preview-member-switcher__head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.6rem;
        margin-bottom: 0.55rem;
      }
      .preview-member-switcher__label {
        font-size: 0.78rem;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.04em;
      }
      .preview-member-switcher__desc {
        font-size: 0.72rem;
        color: #64748b;
      }
      .preview-member-switcher__buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .preview-member-switcher__btn {
        all: unset;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.85rem;
        font-size: 0.78rem;
        font-weight: 600;
        color: #475569;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .preview-member-switcher__btn:hover {
        background: #eff6ff;
        border-color: #c7d2fe;
        color: #1e40af;
      }
      .preview-member-switcher__btn--active,
      .preview-member-switcher__btn--active:hover {
        background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%);
        border-color: transparent;
        color: #ffffff;
      }
    `}</style>
  );
}
