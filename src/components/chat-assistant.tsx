"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // useChatから利用可能な関数と状態を取得
  const chatHelpers = useChat();
  const { messages = [], status, error } = chatHelpers;
  const isLoading = status === "streaming" || status === "submitted";

  // 最下部への自動スクロール処理
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  // チャット送信ハンドラー (複数のSDKバージョンに対応する安全な設計)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputValue.trim();
    if (!textToSend || isLoading) return;

    setInputValue(""); // 入力欄を即座にクリア

    try {
      // 1. sendMessage が関数として存在する場合 (最新仕様)
      if (typeof chatHelpers.sendMessage === "function") {
        await chatHelpers.sendMessage({ text: textToSend });
      }
      // 2. append が関数として存在する場合 (従来仕様)
      else if (typeof (chatHelpers as any).append === "function") {
        await (chatHelpers as any).append({
          role: "user",
          content: textToSend,
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }

    // 送信後も入力欄のフォーカスを維持
    inputRef.current?.focus();
  };

  if (!isOpen) {
    return (
      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg flex items-center justify-center z-50 transition-transform hover:scale-110"
        onClick={() => setIsOpen(true)}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-87.5 h-125 flex flex-col shadow-2xl z-50 animate-in slide-in-from-bottom-5">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-muted/50 rounded-t-xl">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          AIアシスタント
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm mt-8 flex flex-col items-center gap-2">
            <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
            <p>
              業務について何でも質問してください。
              <br />
              例: 「今日の出荷予定は？」
            </p>
          </div>
        ) : (
          messages.map((m) => {
            // content または parts 配列からの安全なテキスト抽出
            const textContent =
              (m as any).content ||
              m.parts
                ?.filter((p) => p.type === "text")
                .map((p) => (p as { type: "text"; text: string }).text)
                .join("") ||
              "";

            return (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"
                  }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-sm whitespace-pre-wrap ${m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-muted rounded-tl-none"
                    }`}
                >
                  {textContent}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2 pl-2">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-150">●</span>
            <span className="animate-pulse delay-300">●</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 bg-red-50 rounded-xl p-3 border border-red-200">
            ⚠️ エラー:{" "}
            {error.message?.includes("credits")
              ? "OpenAIのクレジット残高がありません。billing画面でチャージしてください。"
              : error.message || "通信エラーが発生しました。"}
          </div>
        )}

        {/* スクロール制御用のアンカー要素 */}
        <div ref={messagesEndRef} />
      </CardContent>

      <CardFooter className="p-4 border-t bg-background rounded-b-xl">
        <form onSubmit={handleFormSubmit} className="flex w-full gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !inputValue.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}