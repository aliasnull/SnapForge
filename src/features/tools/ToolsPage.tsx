/** Tools index — the same six tools as the landing grid, with a bit more room. */

import { Icon } from '../../components/Icon';
import { Badge } from '../../components/ui';
import { Link } from '../../lib/router';
import { TOOLS } from './toolCatalog';

export function ToolsPage() {
  return (
    <div className="page container">
      <header className="page-head">
        <p className="page-head__eyebrow">
          <Icon name="grid" size={14} />
          Six tools · All local
        </p>
        <h1>Tools</h1>
        <p>
          Every tool here runs entirely inside this browser tab. Nothing is uploaded, and nothing
          is stored after you close the page.
        </p>
      </header>

      <div className="tool-grid">
        {TOOLS.map((tool) => (
          <Link key={tool.path} to={tool.path} className="tool-card">
            <span className="tool-card__icon">
              <Icon name={tool.icon} size={22} />
            </span>
            <span className="tool-card__title">
              {tool.name}
              {tool.badge ? <Badge tone="brand">{tool.badge}</Badge> : null}
            </span>
            <span className="tool-card__desc">{tool.description}</span>
            <span className="tool-card__action">
              Open Tool
              <Icon name="arrow-right" size={15} />
            </span>
          </Link>
        ))}
      </div>

      <div className="panel panel--pad" style={{ marginTop: 'var(--s-7)' }}>
        <div className="row" style={{ marginBottom: 'var(--s-3)' }}>
          <Icon name="lock" size={18} />
          <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>What every tool has in common</h2>
        </div>
        <ul className="prose" style={{ paddingLeft: '1.1rem' }}>
          <li>Your file is read with the File API and decoded in this tab.</li>
          <li>Edits happen on a canvas — never on a remote machine.</li>
          <li>The result is handed back to you as a download, a share, or a ZIP.</li>
          <li>Closing the tab clears everything. There is nothing left behind.</li>
        </ul>
      </div>
    </div>
  );
}
