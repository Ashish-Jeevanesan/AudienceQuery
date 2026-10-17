/**
 * @file src/components/GuidePage.tsx
 * @description A standalone, public walkthrough of the entire application,
 * routed at /guide -- meant to be shared with reviewers/new staff rather
 * than reached through normal navigation. Covers every role end to end:
 * Audience (Ask a Question), Complaints (Raise a Complaint + Check
 * Status), Moderator, Panel, Stage, Admin, and Management. An internal
 * reference document like /logs or /dashboard -- English-only, same
 * convention as those pages -- but unauthenticated, since it's meant to be
 * opened by people who may not have an account at all yet.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Sun, Moon, X, ZoomIn,
  Compass, MessageSquare, MessageSquareWarning, ShieldCheck, Mic, Monitor, UserCog, LayoutDashboard,
  Vote as VoteIcon
} from 'lucide-react';

interface Shot {
  src: string;
  alt: string;
  caption: string;
}

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  steps: string[];
  shots: Shot[];
  note?: string;
}

const SECTIONS: Section[] = [
  {
    id: 'overview',
    icon: <Compass className="w-5 h-5" />,
    title: 'Overview',
    subtitle: 'One link, three jobs: asking a question, raising a complaint, or voting.',
    steps: [
      'Everyone starts at the same place: the chooser screen.',
      'From there, pick "Ask a Question" for a live event’s Q&A, "Raise a Complaint" to report an issue, or "Vote" to take part in whatever poll is currently open — no login needed for any of them.',
      'Staff (moderator, panel, stage, admin, management) sign in from within those same screens to reach their own view.'
    ],
    shots: [{ src: '/guide/chooser.jpg', alt: 'Chooser screen', caption: 'The chooser screen — everyone’s starting point' }]
  },
  {
    id: 'audience',
    icon: <MessageSquare className="w-5 h-5" />,
    title: 'Audience: Ask a Question',
    subtitle: 'No account needed. Pick an event, write a question, done.',
    steps: [
      'Choose "Ask a Question" from the chooser, or open an event’s direct link/QR code.',
      'If no specific event was linked, pick one from the dropdown.',
      'Write the question, optionally ask anonymously or add a name, then submit.',
      'The question goes to the moderator’s Review Inbox for approval before it can reach the panel or stage.'
    ],
    shots: [
      { src: '/guide/ask-event-picker.jpg', alt: 'Event picker', caption: 'Picking which event’s Q&A to join' },
      { src: '/guide/ask-hero-form.jpg', alt: 'Ask a Question form', caption: 'The event’s hero banner and question form' },
      { src: '/guide/ask-success.jpg', alt: 'Question submitted', caption: 'Confirmation after submitting' }
    ]
  },
  {
    id: 'complaints',
    icon: <MessageSquareWarning className="w-5 h-5" />,
    title: 'Complaints: Raise & Track',
    subtitle: 'Also no account needed — and trackable afterward with a reference number.',
    steps: [
      'Choose "Raise a Complaint" from the chooser.',
      'Enter a name, phone number, and what happened, then submit.',
      'A short reference number (e.g. CMP-9F3A2B1C) appears — save it, it’s the only way to check status later.',
      'Anytime after, switch to the "Check Status" tab and enter that reference number plus the same phone number to see progress.'
    ],
    shots: [
      { src: '/guide/complain-form.jpg', alt: 'Complaint form', caption: 'Filing a complaint' },
      { src: '/guide/complain-success.jpg', alt: 'Complaint submitted', caption: 'The reference number to save' },
      { src: '/guide/complain-status.jpg', alt: 'Status check', caption: 'Checking status by reference number + phone' }
    ]
  },
  {
    id: 'voting',
    icon: <VoteIcon className="w-5 h-5" />,
    title: 'Voting',
    subtitle: 'E.g. picking a theme song — no account needed to vote, plus a staff setup, review, and live results screen.',
    steps: [
      'An admin sets this up first, from "Manage Votings" in the Moderator screen: write a question, add 2 or more options, then open it to the public. More than one voting can be open at once.',
      'Choose "Vote" from the chooser — with one voting open it goes straight to the options, with more than one it asks which poll first.',
      'Pick an option, then confirm with a name, phone number, and date of birth. One vote per phone number per voting — changing the name (even just the case) doesn’t open a second vote.',
      'Staff review every vote in "Vote Monitor," where suspicious patterns (e.g. the same device behind several different phone numbers) are auto-flagged for a human to invalidate if they turn out to be fake.',
      'The results project live, bar by bar, on the Vote Results Stage screen (/vote/stage) — a link next to the Q&A Stage’s fullscreen button jumps straight there.'
    ],
    shots: [
      { src: '/guide/voting-manager.jpg', alt: 'Manage Votings', caption: 'Admin: setting up a voting and watching its live counts' },
      { src: '/guide/vote-options.jpg', alt: 'Vote options', caption: 'The public vote screen — pick an option, no login' },
      { src: '/guide/vote-monitor.jpg', alt: 'Vote Monitor', caption: 'Staff review: a shared-device vote auto-flagged for a closer look' },
      { src: '/guide/vote-stage.jpg', alt: 'Vote Results Stage', caption: 'Live results, projected for the room' }
    ]
  },
  {
    id: 'moderator',
    icon: <ShieldCheck className="w-5 h-5" />,
    title: 'Moderator',
    subtitle: 'Reviews incoming questions and curates what reaches the panel and stage.',
    steps: [
      'Sign in from the Ask a Question screen (Login, top right).',
      'The Review Inbox lists every pending question across all events.',
      'Approve, reject, star (priority), edit, or delete a question — or send it straight to the panel queue.',
      'Also manages events, topic categories, event branding, and (with Vote Monitor) reviewing cast votes — all from the same dashboard. Setting up a voting itself is admin-only; see Voting above.'
    ],
    shots: [{ src: '/guide/moderator-inbox.jpg', alt: 'Moderator Review Inbox', caption: 'The Review Inbox — the moderator’s main workspace' }]
  },
  {
    id: 'panel',
    icon: <Mic className="w-5 h-5" />,
    title: 'Panel',
    subtitle: 'What the panelist sees while answering questions live.',
    steps: [
      'Sign in with a panelist account — this is a locked, single-purpose screen (no other tabs).',
      'The current "Now Answering" question is spotlighted at the top.',
      'A queue of moderator-approved questions sits below, ready to answer next.',
      'Marking a question "Answered" moves it to history and promotes the next one from the queue.'
    ],
    shots: [{ src: '/guide/panel-view.jpg', alt: 'Panel view', caption: 'Panel screen: now answering + queue' }]
  },
  {
    id: 'stage',
    icon: <Monitor className="w-5 h-5" />,
    title: 'Stage',
    subtitle: 'The projected display the audience watches.',
    steps: [
      'Sign in with a stage account, or open it from an admin/moderator account — also a locked, single-purpose screen.',
      'Shows the current question in large type, plus a QR code and join code so the audience can submit their own questions.',
      'An "Up Next" ticker previews what’s coming after the current question.'
    ],
    shots: [{ src: '/guide/stage-view.jpg', alt: 'Stage display', caption: 'Stage display, with the join QR code' }]
  },
  {
    id: 'admin',
    icon: <UserCog className="w-5 h-5" />,
    title: 'Admin',
    subtitle: 'Everything a moderator can do, plus account and access control.',
    steps: [
      'Admin includes every moderator capability, with no separate login.',
      'Exclusively: "Manage Users" — assign any combination of roles (admin, moderator, panelist, stage, management) to any account.',
      'Exclusively: permanently delete an event (soft-delete — irreversible) and reset demo data.',
      'Admin also always has access to the Complaints Dashboard (see Management below).'
    ],
    shots: [{ src: '/guide/admin-manage-users.jpg', alt: 'Manage Users', caption: 'Manage Users — assigning roles' }]
  },
  {
    id: 'management',
    icon: <LayoutDashboard className="w-5 h-5" />,
    title: 'Management: Complaints Dashboard',
    subtitle: 'Works every complaint through to resolution.',
    steps: [
      'Sign in with an admin or management account, then open /dashboard (or the "Go to Dashboard" option from the chooser).',
      'Search by name, phone, or ticket number, or filter by status tabs.',
      'Open a complaint and work it through exactly 3 steps, in order: Categorize → Assign (to anyone, e.g. "Raju - Electrician") → Resolve (with an optional photo, taken live or chosen from the gallery).',
      'Each complaint keeps a timeline of when it moved through each step, plus total time taken once resolved.'
    ],
    shots: [
      { src: '/guide/dashboard-list.jpg', alt: 'Complaints Dashboard list', caption: 'The complaints list, filterable by status' },
      { src: '/guide/dashboard-detail.jpg', alt: 'Complaint detail view', caption: 'A complaint’s timeline and next action' }
    ]
  }
];

const BrowserFrame: React.FC<{ shot: Shot; onZoom: () => void }> = ({ shot, onZoom }) => {
  return (
    <figure className="rounded-xl overflow-hidden border border-divider shadow-sm bg-surface">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-secondary border-b border-divider">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
      </div>
      <button onClick={onZoom} className="block w-full relative group cursor-zoom-in">
        <img src={shot.src} alt={shot.alt} className="w-full h-auto block" loading="lazy" />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-90 transition drop-shadow" />
        </span>
      </button>
      <figcaption className="px-3 py-2 text-xs text-secondary border-t border-divider">{shot.caption}</figcaption>
    </figure>
  );
};

export const GuidePage: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [lightbox, setLightbox] = useState<Shot | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );
    Object.keys(sectionRefs.current).forEach(key => {
      const el = sectionRefs.current[key];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: `rgb(var(--background))` }}>
      <header className="sticky top-0 z-40 bg-surface border-b border-divider">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/root" className="p-2 -ml-2 rounded-lg hover:bg-surface-hover flex-shrink-0" style={{ color: `rgb(var(--text-secondary))` }} title="Back" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div
              style={{ backgroundColor: `rgb(var(--primary))`, color: `rgb(var(--primary-text))` }}
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm tracking-tighter shadow-md flex-shrink-0"
            >
              AQ
            </div>
            <span className="font-bold text-sm truncate" style={{ color: `rgb(var(--text-primary))` }}>
              Application Guide
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover transition flex-shrink-0"
            style={{ color: `rgb(var(--text-secondary))` }}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile: horizontal scrollable section nav */}
        <div className="lg:hidden flex gap-2 overflow-x-auto px-4 pb-3 -mt-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeSection === s.id ? 'bg-indigo-600 text-white' : 'bg-surface-secondary text-secondary border border-divider'
              }`}
            >
              {s.icon} {s.title.replace(/^.*: /, '')}
            </button>
          ))}
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-divider" style={{ backgroundColor: `rgb(var(--hero-background))` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight" style={{ color: `rgb(var(--hero-text-primary))` }}>
            How AudienceQuery works
          </h1>
          <p className="mt-3 text-lg max-w-2xl mx-auto" style={{ color: `rgb(var(--hero-text-secondary))` }}>
            A complete walkthrough, role by role — from an attendee asking a question to the team resolving a complaint.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex gap-10">
        {/* Desktop sticky sidebar nav */}
        <nav className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2.5 transition ${
                  activeSection === s.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-secondary hover:bg-surface-hover'
                }`}
                style={activeSection === s.id ? { backgroundColor: `rgb(var(--nav-active-background))`, color: `rgb(var(--nav-active-text))` } : undefined}
              >
                {s.icon} {s.title.replace(/^.*: /, '')}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-16">
          {SECTIONS.map(section => (
            <section
              key={section.id}
              id={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el; }}
              className="scroll-mt-28"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `rgb(var(--primary))`, color: 'white' }}>
                  {section.icon}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: `rgb(var(--text-primary))`, fontFamily: "'Fraunces', serif" }}>
                  {section.title}
                </h2>
              </div>
              <p className="text-base mb-5" style={{ color: `rgb(var(--text-secondary))` }}>{section.subtitle}</p>

              <ol className="space-y-2.5 mb-6 list-none">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm" style={{ color: `rgb(var(--text-primary))` }}>
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: `rgb(var(--primary-light))`, color: `rgb(var(--primary))` }}
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>

              <div className={`grid gap-4 ${section.shots.length === 1 ? 'max-w-xl' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                {section.shots.map(shot => (
                  <BrowserFrame key={shot.src} shot={shot} onZoom={() => setLightbox(shot)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={lightbox.src} alt={lightbox.alt} className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};
