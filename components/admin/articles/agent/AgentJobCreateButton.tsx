"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { CreateAgentJobDialog } from "./CreateAgentJobDialog";

export function AgentJobCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <PlayCircle className="h-4 w-4" />
        新しいジョブを作成
      </button>
      <CreateAgentJobDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
