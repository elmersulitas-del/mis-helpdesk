'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  TicketMessage,
  TicketStatus,
} from '@/lib/types';

type Props = {
  endpoint: string;
  status: TicketStatus;
  audience: 'EMPLOYEE' | 'MIS';
  accessToken?: string;
};

function messageTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function TicketConversation({
  endpoint,
  status,
  audience,
  accessToken,
}: Props) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement | null>(null);
  const closed = status === 'RESOLVED' || status === 'CANCELLED';

  const headers = useCallback(() => {
    return accessToken
      ? { authorization: `Bearer ${accessToken}` }
      : undefined;
  }, [accessToken]);

  const loadMessages = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);

      try {
        const response = await fetch(endpoint, {
          cache: 'no-store',
          headers: headers(),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          setError(result?.error || 'Unable to load the conversation.');
          return;
        }

        setMessages(result);
        setError('');
      } catch {
        setError('Unable to load the conversation.');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [endpoint, headers]
  );

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(
      () => loadMessages(true),
      5000
    );

    return () => window.clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages.length]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();

    if (!message || closed || sending) return;

    setSending(true);
    setError('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(headers() || {}),
        },
        body: JSON.stringify({ message }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.error || 'Unable to send the message.');
        return;
      }

      setDraft('');
      await loadMessages(true);
    } catch {
      setError('Unable to send the message. Check your connection.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="ticket-conversation">
      <div className="conversation-heading">
        <div>
          <span className="conversation-kicker">Conversation</span>
          <h3>Ticket messages</h3>
        </div>
        <span className="conversation-live">
          <i />
          Updates every 5 seconds
        </span>
      </div>

      <div className="conversation-thread" ref={threadRef}>
        {loading ? (
          <div className="conversation-state">
            <span className="conversation-spinner" />
            Loading messages...
          </div>
        ) : messages.length ? (
          messages.map((message) => {
            const mine = message.sender_type === audience;

            return (
              <article
                className={`conversation-message ${
                  mine ? 'is-mine' : 'is-theirs'
                }`}
                key={message.id}
              >
                <div className="conversation-message-meta">
                  <b>
                    {mine
                      ? audience === 'MIS'
                        ? 'MIS Staff'
                        : 'You'
                      : message.sender_name}
                  </b>
                  <span>{messageTime(message.created_at)}</span>
                </div>
                <p>{message.message}</p>
              </article>
            );
          })
        ) : (
          <div className="conversation-empty">
            <span>💬</span>
            <b>No messages yet</b>
            <p>
              Use this conversation for schedules, clarifications, and
              progress updates.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="conversation-error" role="alert">
          {error}
        </div>
      )}

      {closed ? (
        <div className="conversation-closed">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <div>
            <b>Conversation closed</b>
            <span>
              This ticket is {status.toLowerCase()} and is now read-only.
            </span>
          </div>
        </div>
      ) : (
        <form className="conversation-composer" onSubmit={sendMessage}>
          <label htmlFor={`${audience}-${endpoint}-reply`}>
            {audience === 'MIS'
              ? 'Reply to employee'
              : 'Reply to MIS'}
          </label>
          <textarea
            id={`${audience}-${endpoint}-reply`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              audience === 'MIS'
                ? 'Example: Good morning. Our technician will be available at 10:00 AM.'
                : 'Add more details or ask for an update...'
            }
            maxLength={2000}
            disabled={sending}
          />
          <div className="conversation-composer-footer">
            <span>{draft.length}/2000</span>
            <button type="submit" disabled={!draft.trim() || sending}>
              {sending ? 'Sending...' : 'Send message'}
              {!sending && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m22 2-7 20-4-9-9-4 20-7Z" />
                  <path d="M22 2 11 13" />
                </svg>
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
