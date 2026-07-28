'use client';

import type { Session } from '@supabase/supabase-js';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import TicketConversation from '@/components/TicketConversation';
import TicketForm from '@/components/TicketForm';
import type { Ticket, TicketStatus } from '@/lib/types';

type Props = {
  session: Session;
  fullName: string;
  email: string;
  onSignOut: () => Promise<void>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusText(status: TicketStatus) {
  return status.replaceAll('_', ' ');
}

function technicianLabel(ticket: Ticket) {
  return ticket.assigned_to?.trim() || 'An MIS technician';
}

export default function ClientDashboard({
  session,
  fullName,
  email,
  onSignOut,
}: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'NEW' | 'TICKET'>('NEW');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTickets = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);

      try {
        const response = await fetch('/api/my-tickets', {
          cache: 'no-store',
          headers: {
            authorization: `Bearer ${session.access_token}`,
          },
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          setError(
            result?.error || 'Unable to load your ticket history.'
          );
          return;
        }

        setTickets(result);
        setError('');
      } catch {
        setError('Unable to load your ticket history.');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [session.access_token]
  );

  useEffect(() => {
    loadTickets();
    const timer = window.setInterval(
      () => loadTickets(true),
      10000
    );

    return () => window.clearInterval(timer);
  }, [loadTickets]);

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedId) || null;

  const visibleTickets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tickets;

    return tickets.filter((ticket) =>
      `${ticket.ticket_number} ${ticket.subject} ${ticket.department} ${ticket.status}`
        .toLowerCase()
        .includes(needle)
    );
  }, [tickets, search]);

  const activeCount = tickets.filter(
    (ticket) =>
      ticket.status !== 'RESOLVED' &&
      ticket.status !== 'CANCELLED'
  ).length;

  function openTicket(ticket: Ticket) {
    setSelectedId(ticket.id);
    setView('TICKET');
  }

  return (
    <div className="client-app">
      <header className="client-topbar">
        <div className="client-brand">
          <img
            src="/icclogo.png"
            alt="Immaculada Concepcion College logo"
          />
          <div>
            <b>MIS Helpdesk</b>
            <span>Employee support portal</span>
          </div>
        </div>

        <div className="client-user-menu">
          <span className="client-avatar">
            {fullName.charAt(0).toUpperCase()}
          </span>
          <div>
            <b>{fullName}</b>
            <span>{email}</span>
          </div>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="client-layout">
        <aside className="client-sidebar">
          <div className="client-sidebar-heading">
            <div>
              <span>Your requests</span>
              <b>Ticket history</b>
            </div>
            <span className="client-active-count">
              {activeCount} active
            </span>
          </div>

          <button
            className="client-new-ticket"
            type="button"
            onClick={() => setView('NEW')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New support request
          </button>

          <div className="client-ticket-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tickets..."
              aria-label="Search your tickets"
            />
          </div>

          <div className="client-ticket-list">
            {loading ? (
              <div className="client-sidebar-state">
                Loading ticket history...
              </div>
            ) : visibleTickets.length ? (
              visibleTickets.map((ticket) => (
                <button
                  className={`client-ticket-item ${
                    view === 'TICKET' && selectedId === ticket.id
                      ? 'is-active'
                      : ''
                  }`}
                  type="button"
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                >
                  <div className="client-ticket-item-top">
                    <span>{ticket.ticket_number}</span>
                    <i
                      className={`client-status-dot client-status-dot--${ticket.status.toLowerCase()}`}
                    />
                  </div>
                  <b>{ticket.subject}</b>
                  <p>{statusText(ticket.status)}</p>
                  <time>{formatDate(ticket.updated_at)}</time>
                </button>
              ))
            ) : (
              <div className="client-sidebar-state">
                <b>No tickets found</b>
                <span>
                  Your submitted support requests will appear here.
                </span>
              </div>
            )}
          </div>
        </aside>

        <main className="client-content">
          {error && (
            <div className="client-page-error" role="alert">
              {error}
              <button type="button" onClick={() => loadTickets()}>
                Try again
              </button>
            </div>
          )}

          {view === 'NEW' || !selectedTicket ? (
            <div className="client-new-request-view">
              <div className="client-page-heading">
                <span>New ticket</span>
                <h1>How can MIS help?</h1>
                <p>
                  Describe the concern clearly so our team can prepare
                  before responding.
                </p>
              </div>

              <TicketForm
                session={session}
                fullName={fullName}
                email={email}
                onSubmitted={() => loadTickets(true)}
              />
            </div>
          ) : (
            <div className="client-ticket-view">
              <button
                className="client-mobile-back"
                type="button"
                onClick={() => setView('NEW')}
              >
                ← Back to requests
              </button>

              <header className="client-ticket-header">
                <div>
                  <span>{selectedTicket.ticket_number}</span>
                  <h1>{selectedTicket.subject}</h1>
                  <p>
                    Submitted {formatDate(selectedTicket.created_at)}
                  </p>
                </div>
                <span
                  className={`status-pill status-pill--${selectedTicket.status.toLowerCase()}`}
                >
                  {statusText(selectedTicket.status)}
                </span>
              </header>

              <section
                className={`client-status-update client-status-update--${selectedTicket.status.toLowerCase()}`}
                role="status"
              >
                <div className="client-status-update-icon">
                  {selectedTicket.status === 'RESOLVED' ? '✓' : 'i'}
                </div>
                <div>
                  <span>Ticket status update</span>

                  {selectedTicket.status === 'PENDING' && (
                    <>
                      <h2>Your request has been received.</h2>
                      <p>
                        Your concern is waiting for an available MIS
                        technician. We will update this ticket once
                        someone has been assigned.
                      </p>
                    </>
                  )}

                  {selectedTicket.status === 'ACCEPTED' && (
                    <>
                      <h2>Your concern has been accepted.</h2>
                      <p>
                        <b>{technicianLabel(selectedTicket)}</b> from
                        the MIS team has been assigned to your request
                        and is on the way. Please keep the area
                        accessible.
                      </p>
                    </>
                  )}

                  {selectedTicket.status === 'IN_PROGRESS' && (
                    <>
                      <h2>Your concern is being handled.</h2>
                      <p>
                        <b>{technicianLabel(selectedTicket)}</b> is
                        currently working on your request. You may send
                        additional details through the conversation
                        below.
                      </p>
                    </>
                  )}

                  {selectedTicket.status === 'RESOLVED' && (
                    <>
                      <h2>Your concern has been resolved.</h2>
                      <p>
                        The MIS team has completed this request. Review
                        the resolution details below for the action
                        taken.
                      </p>
                    </>
                  )}

                  {selectedTicket.status === 'CANCELLED' && (
                    <>
                      <h2>This request has been cancelled.</h2>
                      <p>
                        This ticket is now closed. Please submit a new
                        support request if you still need assistance.
                      </p>
                    </>
                  )}
                </div>
              </section>

              <section className="client-ticket-summary">
                <div>
                  <span>Department</span>
                  <b>{selectedTicket.department}</b>
                </div>
                <div>
                  <span>Location</span>
                  <b>{selectedTicket.location}</b>
                </div>
                <div>
                  <span>Category</span>
                  <b>{selectedTicket.category}</b>
                </div>
                <div>
                  <span>Assigned technician</span>
                  <b>
                    {selectedTicket.assigned_to || 'Not assigned yet'}
                  </b>
                </div>
              </section>

              <section className="client-concern-card">
                <span>Concern details</span>
                <p>{selectedTicket.description}</p>
              </section>

              {selectedTicket.resolution_notes && (
                <section className="client-resolution-card">
                  <span>Resolution / action taken</span>
                  <p>{selectedTicket.resolution_notes}</p>
                </section>
              )}

              <TicketConversation
                endpoint={`/api/my-tickets/${selectedTicket.id}/messages`}
                status={selectedTicket.status}
                audience="EMPLOYEE"
                accessToken={session.access_token}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
