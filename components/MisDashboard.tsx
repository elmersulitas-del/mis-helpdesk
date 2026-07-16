'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ticket, TicketStatus } from '@/lib/types';

type ThemeMode = 'light' | 'auto' | 'dark';

const STATUS_OPTIONS: Array<'ALL' | TicketStatus> = [
  'ALL',
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED',
];

function playDefault(volume = 1) {
  const AudioContextClass =
    window.AudioContext ||
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();

  [0, 0.25, 0.5].forEach((delay) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(0.001, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.01, volume * 0.7),
      context.currentTime + delay + 0.02
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + delay + 0.18
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + 0.2);
  });
}

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function monthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;

  const [year, month] = value.split('-').map(Number);

  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusText(status: string) {
  return status.replaceAll('_', ' ');
}

export default function MisDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<'ALL' | TicketStatus>('ALL');
  const [search, setSearch] = useState('');
  const [ready, setReady] = useState(false);
  const [volume, setVolume] = useState(1);
  const [theme, setTheme] = useState<ThemeMode>('auto');
  const [reportMonth, setReportMonth] = useState(monthValue());
  const [activeView, setActiveView] = useState<'tickets' | 'reports'>(
    'tickets'
  );

  const audio = useRef<HTMLAudioElement | null>(null);
  const known = useRef(new Set<string>());

  const load = useCallback(
    async (initial = false) => {
      try {
        const response = await fetch('/api/tickets', {
          cache: 'no-store',
        });

        if (response.status === 401) {
          location.href = '/mis/login';
          return;
        }

        if (!response.ok) {
          console.error('Unable to load tickets.');
          return;
        }

        const data: Ticket[] = await response.json();

        if (!initial && ready) {
          const fresh = data.filter(
            (ticket) => !known.current.has(ticket.id)
          );

          if (fresh.length) {
            const savedVolume = Number(
              localStorage.getItem('misVolume') || '1'
            );

            const src = localStorage.getItem('misSound');

            if (src) {
              audio.current = new Audio(src);
              audio.current.volume = savedVolume;

              audio.current
                .play()
                .catch(() => playDefault(savedVolume));
            } else {
              playDefault(savedVolume);
            }

            if (
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification('New MIS support request', {
                body: `${fresh[0].department}: ${fresh[0].subject}`,
              });
            }
          }
        }

        known.current = new Set(data.map((ticket) => ticket.id));
        setTickets(data);
        setReady(true);
      } catch (error) {
        console.error('Ticket loading error:', error);
      }
    },
    [ready]
  );

  useEffect(() => {
    setVolume(Number(localStorage.getItem('misVolume') || '1'));

    const savedTheme =
      (localStorage.getItem('misTheme') as ThemeMode | null) || 'auto';

    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    document.documentElement.style.colorScheme =
      savedTheme === 'auto' ? 'light dark' : savedTheme;

    load(true);

    const timer = setInterval(() => {
      load(false);
    }, 5000);

    return () => clearInterval(timer);
  }, [load]);

  async function update(ticket: Ticket, status: TicketStatus) {
    let resolutionNotes = ticket.resolution_notes || '';

    if (status === 'RESOLVED') {
      resolutionNotes =
        prompt(
          'Resolution notes / action taken:',
          resolutionNotes
        ) || resolutionNotes;

      if (!resolutionNotes.trim()) return;
    }

    const assignedTo =
      ticket.assigned_to ||
      prompt('Assigned technician name:', 'MIS Staff') ||
      'MIS Staff';

    const response = await fetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status,
        assigned_to: assignedTo,
        resolution_notes: resolutionNotes,
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      alert(result?.error || 'Unable to update the ticket.');
      return;
    }

    load(true);
  }

  async function enableSound() {
    if (
      'Notification' in window &&
      Notification.permission !== 'granted'
    ) {
      await Notification.requestPermission();
    }

    playDefault(volume);
  }

  function chooseSound(file?: File) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      localStorage.setItem('misSound', String(reader.result));
    };

    reader.readAsDataURL(file);
  }

  function applyTheme(mode: ThemeMode) {
    setTheme(mode);
    localStorage.setItem('misTheme', mode);

    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme =
      mode === 'auto' ? 'light dark' : mode;
  }

  const visibleTickets = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus =
        filter === 'ALL' || ticket.status === filter;

      const haystack = `
        ${ticket.ticket_number}
        ${ticket.reporter_name}
        ${ticket.reporter_email ?? ''}
        ${ticket.department}
        ${ticket.location}
        ${ticket.subject}
        ${ticket.description}
      `.toLowerCase();

      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [tickets, filter, search]);

  const monthlyAccomplishments = useMemo(() => {
    return tickets
      .filter(
        (ticket) =>
          ticket.status === 'RESOLVED' &&
          ticket.resolved_at?.slice(0, 7) === reportMonth
      )
      .sort(
        (a, b) =>
          new Date(a.resolved_at || 0).getTime() -
          new Date(b.resolved_at || 0).getTime()
      );
  }, [tickets, reportMonth]);

  const reportDepartments = useMemo(() => {
    return new Set(
      monthlyAccomplishments.map((ticket) => ticket.department)
    ).size;
  }, [monthlyAccomplishments]);

  const reportTechnicians = useMemo(() => {
    return new Set(
      monthlyAccomplishments
        .map((ticket) => ticket.assigned_to)
        .filter(Boolean)
    ).size;
  }, [monthlyAccomplishments]);

  const count = (status: TicketStatus) =>
    tickets.filter((ticket) => ticket.status === status).length;

  return (
    <div className="mis-app">
      <header className="mis-topbar no-print">
        <div className="mis-brand">
          <img
            className="mis-brand__logo"
            src="/icclogo.png"
            alt="Immaculada Concepcion College logo"
          />

          <div>
            <strong>Immaculada MIS Helpdesk</strong>
            <span>Support operations dashboard</span>
          </div>
        </div>

        <div className="mis-topbar__actions">
          <div
            className="theme-control"
            role="radiogroup"
            aria-label="Color scheme"
          >
            {(['light', 'auto', 'dark'] as ThemeMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  className={theme === mode ? 'is-active' : ''}
                  aria-checked={theme === mode}
                  role="radio"
                  onClick={() => applyTheme(mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            onClick={enableSound}
          >
            Test sound
          </button>

          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            onClick={async () => {
              await fetch('/api/auth/logout', {
                method: 'POST',
              });

              location.href = '/mis/login';
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mis-layout">
        <aside className="mis-sidebar no-print">
          <div className="side-label">Workspace</div>

          <button
            type="button"
            className={`side-link ${
              activeView === 'tickets' ? 'is-active' : ''
            }`}
            onClick={() => setActiveView('tickets')}
          >
            <span>Tickets</span>
            <b>{tickets.length}</b>
          </button>

          <button
            type="button"
            className={`side-link ${
              activeView === 'reports' ? 'is-active' : ''
            }`}
            onClick={() => setActiveView('reports')}
          >
            <span>Accomplishment report</span>
            <b>{count('RESOLVED')}</b>
          </button>

          <div className="side-label side-label--spaced">
            Live status
          </div>

          <div className="live-indicator">
            <i />
            Auto-refresh every 5 seconds
          </div>
        </aside>

        <main className="mis-content">
          {activeView === 'tickets' ? (
            <>
              <section className="dashboard-hero no-print">
                <p className="eyebrow">
                  MIS service desk · live overview
                </p>

                <h1>
                  Support requests,
                  <br />
                  clearly organized.
                </h1>

                <p>
                  Receive institutional requests, assign technicians,
                  record actions taken, and close concerns from one
                  dashboard.
                </p>
              </section>

              <section className="metric-grid no-print">
                <article className="metric-card metric-card--feature">
                  <span>Pending</span>
                  <b>{count('PENDING')}</b>
                  <small>Needs attention</small>
                </article>

                <article className="metric-card">
                  <span>Accepted</span>
                  <b>{count('ACCEPTED')}</b>
                  <small>Technician assigned</small>
                </article>

                <article className="metric-card">
                  <span>In progress</span>
                  <b>{count('IN_PROGRESS')}</b>
                  <small>Currently being handled</small>
                </article>

                <article className="metric-card">
                  <span>Resolved</span>
                  <b>{count('RESOLVED')}</b>
                  <small>Total accomplishments</small>
                </article>
              </section>

              <section className="panel no-print">
                <div className="panel-head">
                  <div>
                    <p className="panel-kicker">Ticket queue</p>
                    <h2>All support requests</h2>
                  </div>

                  <span className="result-count">
                    {visibleTickets.length} result
                    {visibleTickets.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="filterbar">
                  <input
                    aria-label="Search tickets"
                    placeholder="Search ticket, employee, department..."
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                  />

                  <select
                    aria-label="Filter by status"
                    value={filter}
                    onChange={(event) =>
                      setFilter(
                        event.target.value as
                          | 'ALL'
                          | TicketStatus
                      )
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status === 'ALL'
                          ? 'All statuses'
                          : statusText(status)}
                      </option>
                    ))}
                  </select>

                  <label className="ui-btn ui-btn--ghost file-button">
                    Choose alert sound
                    <input
                      hidden
                      type="file"
                      accept="audio/*"
                      onChange={(event) =>
                        chooseSound(event.target.files?.[0])
                      }
                    />
                  </label>

                  <label className="volume-control">
                    <span>Volume</span>

                    <input
                      title="Notification volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(event) => {
                        const next = Number(event.target.value);

                        setVolume(next);
                        localStorage.setItem(
                          'misVolume',
                          String(next)
                        );
                      }}
                    />
                  </label>
                </div>

                <div className="ticket-list">
                  {visibleTickets.map((ticket) => (
                    <article
                      className="ticket-card"
                      key={ticket.id}
                    >
                      <div className="ticket-card__head">
                        <div>
                          <div className="ticket-code">
                            {ticket.ticket_number}
                          </div>

                          <h3>{ticket.subject}</h3>

                          <p>
                            {formatDate(ticket.created_at)} ·{' '}
                            {ticket.reporter_name} ·{' '}
                            {ticket.department}
                          </p>
                        </div>

                        <span
                          className={`status-pill status-pill--${ticket.status.toLowerCase()}`}
                        >
                          {statusText(ticket.status)}
                        </span>
                      </div>

                      <p className="ticket-description">
                        {ticket.description}
                      </p>

                      <dl className="ticket-details">
                        <div>
                          <dt>Location</dt>
                          <dd>{ticket.location}</dd>
                        </div>

                        <div>
                          <dt>Category</dt>
                          <dd>{ticket.category}</dd>
                        </div>

                        <div>
                          <dt>Priority</dt>
                          <dd>{ticket.priority}</dd>
                        </div>

                        <div>
                          <dt>Assigned</dt>
                          <dd>
                            {ticket.assigned_to || 'Not assigned'}
                          </dd>
                        </div>
                      </dl>

                      {ticket.resolution_notes && (
                        <div className="resolution-box">
                          <b>Action taken</b>
                          <span>{ticket.resolution_notes}</span>
                        </div>
                      )}

                      <div className="ticket-actions">
                        {ticket.status === 'PENDING' && (
                          <button
                            type="button"
                            className="ui-btn"
                            onClick={() =>
                              update(ticket, 'ACCEPTED')
                            }
                          >
                            Accept request
                          </button>
                        )}

                        {ticket.status === 'ACCEPTED' && (
                          <button
                            type="button"
                            className="ui-btn ui-btn--warm"
                            onClick={() =>
                              update(ticket, 'IN_PROGRESS')
                            }
                          >
                            Start work
                          </button>
                        )}

                        {ticket.status !== 'RESOLVED' &&
                          ticket.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="ui-btn ui-btn--success"
                              onClick={() =>
                                update(ticket, 'RESOLVED')
                              }
                            >
                              Mark resolved
                            </button>
                          )}

                        {ticket.status !== 'RESOLVED' &&
                          ticket.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="ui-btn ui-btn--danger"
                              onClick={() =>
                                update(ticket, 'CANCELLED')
                              }
                            >
                              Cancel
                            </button>
                          )}
                      </div>
                    </article>
                  ))}

                  {!visibleTickets.length && (
                    <div className="empty-state">
                      <b>No tickets found</b>
                      <span>
                        Try a different search or status filter.
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="report-page">
              <div className="report-toolbar no-print">
                <div>
                  <p className="panel-kicker">
                    Monthly reporting
                  </p>

                  <h1>Accomplishment Report</h1>

                  <p>
                    Select a month, review resolved concerns,
                    then print or save as PDF.
                  </p>
                </div>

                <div className="report-controls">
                  <label>
                    <span>Report month</span>

                    <input
                      type="month"
                      value={reportMonth}
                      onChange={(event) =>
                        setReportMonth(event.target.value)
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="ui-btn"
                    onClick={() => window.print()}
                  >
                    Print report
                  </button>
                </div>
              </div>

              <div className="print-report">
                <header className="print-report__header">
                  <img
                    className="report-logo"
                    src="/icclogo.png"
                    alt="Immaculada Concepcion College logo"
                  />

                  <div className="report-heading">
                    

                    <h2>Immaculada Concepcion College</h2>

                    <h3>
                      Management Information Systems Office
                    </h3>

                    <h1>Monthly Accomplishment Report</h1>

                    <span>
                      Reporting period: {monthLabel(reportMonth)}
                    </span>
                  </div>
                </header>

                <section className="report-summary no-print">
                  <div>
                    <span>Completed concerns</span>
                    <b>{monthlyAccomplishments.length}</b>
                  </div>

                  <div>
                    <span>Departments served</span>
                    <b>{reportDepartments}</b>
                  </div>

                  <div>
                    <span>MIS personnel involved</span>
                    <b>{reportTechnicians}</b>
                  </div>
                </section>

                <div className="report-table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date resolved</th>
                        <th>Ticket / Requester</th>
                        <th>Department / Location</th>
                        <th>Category</th>
                        <th>Concern</th>
                        <th>Action taken</th>
                        <th>Technician</th>
                      </tr>
                    </thead>

                    <tbody>
                      {monthlyAccomplishments.map(
                        (ticket, index) => (
                          <tr key={ticket.id}>
                            <td>{index + 1}</td>

                            <td>
                              {formatDate(ticket.resolved_at)}
                            </td>

                            <td>
                              <b>{ticket.ticket_number}</b>
                              <br />
                              <span>{ticket.reporter_name}</span>
                            </td>

                            <td>
                              <b>{ticket.department}</b>
                              <br />
                              <span>{ticket.location}</span>
                            </td>

                            <td>{ticket.category}</td>

                            <td>
                              <b>{ticket.subject}</b>
                              <br />
                              <span>{ticket.description}</span>
                            </td>

                            

                            <td>
                              {ticket.resolution_notes ||
                                'Resolved'}
                            </td>

                            <td>
                              {ticket.assigned_to || 'MIS Staff'}
                            </td>
                          </tr>
                        )
                      )}

                      {!monthlyAccomplishments.length && (
                        <tr>
                          <td
                            colSpan={8}
                            className="report-empty"
                          >
                            No resolved tickets recorded for{' '}
                            {monthLabel(reportMonth)}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}