/**
 * App shell: skip link, header (desktop nav + theme toggle), mobile tab bar,
 * footer, and the router outlet.
 */

import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Badge, IconButton } from './ui';
import { Link, useIsActive, useRouter } from '../lib/router';
import { useTheme } from '../state/ThemeProvider';
import { APP_VERSION, GITHUB_URL, HAS_GITHUB_URL } from '../config';

/* -------------------------------------------------------------------------- */
/* Logo                                                                       */
/* -------------------------------------------------------------------------- */

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="SnapForge"
    >
      <defs>
        <linearGradient id="sf-logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#4f7cff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#sf-logo-gradient)" />
      <path
        d="M9.5 21.5c1.6 1.3 3.6 2 5.9 2 3.2 0 5.4-1.5 5.4-3.8 0-2.1-1.5-3.2-4.6-3.9l-1.9-.4c-1.6-.4-2.3-.9-2.3-1.8 0-1.1 1.1-1.8 2.8-1.8 1.5 0 2.9.5 4.1 1.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M22.5 6.5v3.4M20.8 8.2h3.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation model                                                           */
/* -------------------------------------------------------------------------- */

interface NavItem {
  path: string;
  label: string;
  icon: 'home' | 'grid' | 'history' | 'settings';
}

const PRIMARY_NAV: NavItem[] = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/tools', label: 'Tools', icon: 'grid' },
  { path: '/history', label: 'History', icon: 'history' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

const DESKTOP_NAV = [
  { path: '/tools', label: 'Tools' },
  { path: '/history', label: 'History' },
  { path: '/privacy', label: 'Privacy' },
  { path: '/settings', label: 'Settings' },
];

function HeaderLink({ item }: { item: { path: string; label: string } }) {
  const active = useIsActive(item.path, item.path === '/');
  return (
    <Link
      to={item.path}
      className="header__link"
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      {item.label}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Theme toggle                                                               */
/* -------------------------------------------------------------------------- */

function ThemeToggle() {
  const { preference, resolved, cycle } = useTheme();

  const label =
    preference === 'system'
      ? `Theme: follow system (currently ${resolved}). Switch to dark.`
      : preference === 'dark'
        ? 'Theme: dark. Switch to light.'
        : 'Theme: light. Switch to follow system.';

  return (
    <IconButton
      icon={preference === 'system' ? 'monitor' : preference === 'dark' ? 'moon' : 'sun'}
      label={label}
      onClick={cycle}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function Header() {
  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="brand" aria-label="SnapForge home">
          <Logo />
          <span>SnapForge</span>
        </Link>

        <nav className="header__nav" aria-label="Main">
          {DESKTOP_NAV.map((item) => (
            <HeaderLink key={item.path} item={item} />
          ))}
        </nav>

        <div className="header__actions">
          <Badge tone="success" icon="lock" className="header__cta">
            Local only
          </Badge>
          <ThemeToggle />
          <Link to="/compress" className="btn btn--primary header__cta">
            Start Editing
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile tab bar                                                             */
/* -------------------------------------------------------------------------- */

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Primary">
      {PRIMARY_NAV.map((item) => {
        const active = useIsActive(item.path, item.path === '/');
        return (
          <Link
            key={item.path}
            to={item.path}
            className="tabbar__item"
            {...(active ? { 'aria-current': 'page' as const } : {})}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

const TOOL_LINKS = [
  { path: '/compress', label: 'Compress' },
  { path: '/resize', label: 'Resize' },
  { path: '/convert', label: 'Convert' },
  { path: '/crop', label: 'Crop' },
  { path: '/rotate', label: 'Rotate & Flip' },
  { path: '/batch', label: 'Batch' },
];

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link to="/" className="brand">
              <Logo size={26} />
              <span>SnapForge</span>
            </Link>
            <p className="footer__tagline">Fast. Private. In Your Browser.</p>
            <p className="footer__promise">
              <Icon name="lock" size={15} />
              Your images never leave your device.
            </p>
          </div>

          <div>
            <h2 className="footer__title">Tools</h2>
            <div className="footer__links">
              {TOOL_LINKS.map((item) => (
                <Link key={item.path} to={item.path}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="footer__title">Project</h2>
            <div className="footer__links">
              <Link to="/privacy">Privacy</Link>
              <Link to="/about">About</Link>
              <Link to="/settings">Settings</Link>
              {HAS_GITHUB_URL ? (
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  <span className="icon-text">
                    <Icon name="github" size={15} />
                    GitHub
                  </span>
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span>SnapForge v{APP_VERSION} · MIT licensed</span>
          <span>No uploads · No accounts · No tracking</span>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

export function AppShell({ children }: { children: ReactNode }) {
  const { route } = useRouter();

  // Announce route changes to assistive tech and keep focus sensible.
  useEffect(() => {
    const heading = document.querySelector('main h1');
    if (heading instanceof HTMLElement) {
      heading.setAttribute('tabindex', '-1');
    }
  }, [route.path]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="app-main">
        {children}
      </main>
      <Footer />
      <TabBar />
    </>
  );
}
