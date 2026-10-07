"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getOlderMessages, sendMessage } from "../action";

export default function MessageList({
  initialMessages,
  teamId,
  channelId,
}: {
  initialMessages: {
    id: number;
    content: string;
    createdAt: Date;
    sender: {
      id: number;
      name: string | null;
      email: string;
    };
  }[];
  teamId: number;
  channelId: number;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  const previousScrollHeightRef = useRef<number | null>(null);
  const isLoadingRef = useRef(false);

  async function loadOlderMessages() {
    if (!hasMore || isLoadingRef.current || messages.length === 0) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const oldestMessage = messages[0];

      const container = scrollContainerRef.current;

      if (container) {
        previousScrollHeightRef.current = container.scrollHeight;
      }

      const result = await getOlderMessages(teamId, channelId, oldestMessage.id);

      setMessages((current) => [...result.messages, ...current]);

      setHasMore(result.hasMore);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const previousScrollHeight = previousScrollHeightRef.current;

    if (!container || previousScrollHeight === null) {
      return;
    }

    const newScrollHeight = container.scrollHeight;

    container.scrollTop += newScrollHeight - previousScrollHeight;

    previousScrollHeightRef.current = null;
  }, [messages]);

  useEffect(() => {
    if (!hasMore) return;

    const container = scrollContainerRef.current;
    const top = topRef.current;

    if (!container || !top) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadOlderMessages();
        }
      },
      {
        root: container,
        threshold: 1,
      }
    );

    observer.observe(top);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, messages]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const newMessage = await sendMessage(formData);

    setMessages((current) => [...current, newMessage]);

    event.currentTarget.reset();
  }

  return (
    <div ref={scrollContainerRef} className="h-[500px] overflow-y-auto">
      <div ref={topRef} />

      {messages.map((message) => (
        <div key={message.id}>
          <strong>{message.sender.name || message.sender.email}</strong>

          <p>{message.content}</p>

          <small>{message.createdAt.toLocaleString()}</small>
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input name="content" placeholder="Type a message..." />

        <input type="hidden" name="teamId" value={teamId} />

        <input type="hidden" name="channelId" value={channelId} />

        <button type="submit">Send</button>
      </form>

      {isLoading && <p>Loading older messages...</p>}
    </div>
  );
}
