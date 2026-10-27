"use client";

import { useUiText } from "@/hooks/use-ui-text";

import { Button } from "@/components/ui/button";
import { SendHorizontal, Square } from "lucide-react";

interface SendButtonProps {
  isStreaming: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}

/**
 * Toggles between a Send button and a Stop button depending on
 * whether the chat is currently streaming a response.
 */
export function SendButton({
  isStreaming,
  canSend,
  onSend,
  onStop,
}: SendButtonProps) {
  const ui = useUiText();
  if (isStreaming) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="icon-xs"
        className="mb-0.5 rounded-full"
        data-testid="chat-stop"
        onClick={onStop}
        title={ui("Stop generating")}
        aria-label={ui("Stop generating")}
      >
        <Square className="size-3" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      size="icon-xs"
      className="mb-0.5 rounded-full"
      data-testid="chat-send"
      onClick={onSend}
      disabled={!canSend}
      aria-disabled={!canSend}
      title={ui("Send message")}
      aria-label={ui("Send message")}
    >
      <SendHorizontal className="size-3.5" />
    </Button>
  );
}
