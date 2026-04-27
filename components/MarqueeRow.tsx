"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function MarqueeRow({ children }: Props) {
  return (
    <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
      <div className="flex w-max gap-4 animate-marquee group-hover:[animation-play-state:paused]">
        <div className="flex shrink-0 gap-4">{children}</div>
        <div aria-hidden className="flex shrink-0 gap-4">
          {children}
        </div>
      </div>
    </div>
  );
}
