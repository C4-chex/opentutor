"use client";

import { MessageCircle, X } from "lucide-react";
import { useUiText } from "@/hooks/use-ui-text";
import { cn } from "@/lib/utils";

interface ChatFabProps {
  open: boolean;
  onToggle: () => void;
  hasUnread?: boolean;
}

export function ChatFab({ open, onToggle, hasUnread }: ChatFabProps) {
  const ui = useUiText();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? ui("Close chat") : ui("Open chat")}
      aria-expanded={open}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center justify-center",
        "w-14 h-14 rounded-full transition-all duration-300",
        "hover:scale-105 active:scale-95",
        open
          ? "bg-muted text-muted-foreground hover:bg-muted/80 shadow-md"
          : "bg-brand text-brand-foreground hover:bg-brand/90 shadow-lg hover:shadow-xl",
      )}
    >
      {open ? <X className="size-5" aria-hidden="true" /> : <MessageCircle className="size-5" aria-hidden="true" />}
      {!open && hasUnread && (
        <span className="absolute top-1 right-1 w-3 h-3 bg-destructive rounded-full border-2 border-background" />
      )}
    </button>
  );
}
