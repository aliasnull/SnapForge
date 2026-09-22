/** Settings — theme, processing defaults, privacy, and about. */

import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Button, Callout, Modal, RangeField, Segmented, Switch } from '../../components/ui';
import { FormatSelect } from '../../components/FormatSelect';
import { Link } from '../../lib/router';
import { formatBytes } from '../../lib/format';
import { historyFootprint } from '../../lib/history';
import { getCapabilities, supportedOutputFormats } from '../../lib/capabilities';
import { clearAppShellCache } from '../../lib/offline';
import { useSettings, resetSettings, updateSettings } from '../../state/settingsStore';
import { useHistory, useHistoryActions } from '../../state/historyStore';
import { useTheme } from '../../state/ThemeProvider';
import { useToast } from '../../state/ToastProvider';
import { APP_VERSION, GITHUB_URL, HAS_GITHUB_URL } from '../../config';
import type { OutputFormat, ThemePreference } from '../../lib/types';

export function SettingsPage() {
  const [settings] = useSettings();
  const { setPreference } = useTheme();
  const history = useHistory();
  const { clear } = useHistoryActions();
  const toast = useToast();
  const caps = getCapabilities();
  const [clearOpen, setClearOpen] = useState(false);

  const footprint = historyFootprint(history);
  const available = supportedOutputFormats(caps);

  return (
    <div className="page container">
      <header className="page-head">
        <p className="page-head__eyebrow">
          <Icon name="settings" size={14} />
          Saved on this device
        </p>
        <h1>Settings</h1>
        <p>Preferences are stored locally in this browser. There is no account and no sync.</p>
      </header>

      <div className="settings-grid">
        {/* ---------------------------------------------------------- theme */}
        <section className="settings-card" aria-labelledby="settings-theme">
          <h2 className="settings-card__title" id="settings-theme">
            <Icon name="palette" size={18} />
            Theme
          </h2>

          <div className="field">
            <span className="label">Appearance</span>
            <Segmented<ThemePreference>
              ariaLabel="Theme"
              value={settings.theme}
              onValueChange={(value) => {
                setPreference(value);
                toast.success('Theme updated');
              }}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <p className="hint">
              “System” follows your device's dark-mode setting and updates automatically. Switching
              never reloads the page.
            </p>
          </div>
        </section>

        {/* ----------------------------------------------------- processing */}
        <section className="settings-card" aria-labelledby="settings-processing">
          <h2 className="settings-card__title" id="settings-processing">
            <Icon name="sliders" size={18} />
            Processing defaults
          </h2>

          <FormatSelect
            label="Default output format"
            value={settings.defaultFormat}
            onValueChange={(value: OutputFormat) => {
              updateSettings({ defaultFormat: value });
              toast.success('Default format saved');
            }}
            hint={`Available here: ${available.map((item) => item.replace('image/', '').toUpperCase()).join(', ')}.`}
          />

          <RangeField
            label="Default quality"
            value={Math.round(settings.defaultQuality * 100)}
            min={10}
            max={100}
            displayValue={`${Math.round(settings.defaultQuality * 100)}%`}
            onValueChange={(value) => updateSettings({ defaultQuality: value / 100 })}
            hint="Used as the starting point in the Compressor, Converter and Batch tools."
          />

          <div className="setting-row">
            <div>
              <div className="setting-row__label">Lock aspect ratio by default</div>
              <div className="setting-row__desc">
                Keeps the Resizer's width and height tied together until you unlock them.
              </div>
            </div>
            <Switch
              checked={settings.lockAspectByDefault}
              onCheckedChange={(value) => updateSettings({ lockAspectByDefault: value })}
              label=""
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-row__label">Preserve original dimensions</div>
              <div className="setting-row__desc">
                The Compressor only shrinks an image when you ask it to.
              </div>
            </div>
            <Switch
              checked={settings.preserveOriginalSize}
              onCheckedChange={(value) => updateSettings({ preserveOriginalSize: value })}
              label=""
            />
          </div>
        </section>

        {/* -------------------------------------------------------- privacy */}
        <section className="settings-card" aria-labelledby="settings-privacy">
          <h2 className="settings-card__title" id="settings-privacy">
            <Icon name="lock" size={18} />
            Privacy
          </h2>

          <p className="hint" style={{ margin: 0 }}>
            SnapForge has no server, so there is no image data anywhere to delete. The only thing
            stored on this device is the history list and these preferences.
          </p>

          <div className="kv">
            <dt>History records</dt>
            <dd>{history.length}</dd>
          </div>
          <div className="kv">
            <dt>Local storage used</dt>
            <dd>{formatBytes(footprint)}</dd>
          </div>
          <div className="kv">
            <dt>Images stored</dt>
            <dd>0</dd>
          </div>

          <div className="actions-row">
            <Button
              variant="danger"
              icon="trash"
              onClick={() => setClearOpen(true)}
              disabled={history.length === 0}
            >
              Clear local history
            </Button>
            <Link to="/privacy" className="btn btn--secondary">
              Privacy details
            </Link>
          </div>
        </section>

        {/* ---------------------------------------------------------- about */}
        <section className="settings-card" aria-labelledby="settings-about">
          <h2 className="settings-card__title" id="settings-about">
            <Icon name="info" size={18} />
            About
          </h2>

          <dl style={{ margin: 0 }}>
            <div className="kv">
              <dt>Version</dt>
              <dd>{APP_VERSION}</dd>
            </div>
            <div className="kv">
              <dt>License</dt>
              <dd>MIT</dd>
            </div>
            <div className="kv">
              <dt>Runtime dependencies</dt>
              <dd>React, React DOM</dd>
            </div>
            <div className="kv">
              <dt>Image pipeline</dt>
              <dd>Canvas · ImageBitmap · Blob</dd>
            </div>
            {HAS_GITHUB_URL ? (
              <div className="kv">
                <dt>Source</dt>
                <dd>
                  <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                    GitHub
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="field">
            <span className="label">This browser's capabilities</span>
            <div className="pill-row">
              <span className={`badge ${caps.webpEncode ? 'badge--success' : ''}`}>
                <Icon name={caps.webpEncode ? 'check' : 'close'} size={13} />
                WebP encode
              </span>
              <span className={`badge ${caps.avifEncode ? 'badge--success' : ''}`}>
                <Icon name={caps.avifEncode ? 'check' : 'close'} size={13} />
                AVIF encode
              </span>
              <span className={`badge ${caps.offscreenCanvas ? 'badge--success' : ''}`}>
                <Icon name={caps.offscreenCanvas ? 'check' : 'close'} size={13} />
                OffscreenCanvas
              </span>
              <span className={`badge ${caps.clipboardImage ? 'badge--success' : ''}`}>
                <Icon name={caps.clipboardImage ? 'check' : 'close'} size={13} />
                Clipboard paste
              </span>
              <span className={`badge ${caps.share ? 'badge--success' : ''}`}>
                <Icon name={caps.share ? 'check' : 'close'} size={13} />
                Share sheet
              </span>
            </div>
            <p className="hint">
              Formats that are not supported here are shown as disabled everywhere in the app
              rather than failing later.
            </p>
          </div>

          <Callout tone="info" title="Open source licenses">
            SnapForge itself is MIT licensed. It bundles React and React DOM (MIT). The ZIP writer
            and every image operation are implemented in this repository — no third-party image
            processing library is loaded at runtime.
          </Callout>

          <Button
            variant="ghost"
            icon="arrow-left"
            onClick={() => {
              resetSettings();
              toast.success('Settings reset to defaults');
            }}
          >
            Reset settings to defaults
          </Button>

          <Button
            variant="ghost"
            icon="refresh"
            onClick={() => {
              void clearAppShellCache().then(() => {
                toast.success('Offline cache cleared', 'The app will re-download on next load.');
              });
            }}
          >
            Clear offline cache
          </Button>
        </section>
      </div>

      <Modal
        open={clearOpen}
        title="Clear local history?"
        onClose={() => setClearOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                clear();
                setClearOpen(false);
                toast.success('Local history cleared');
              }}
            >
              Clear history
            </Button>
          </>
        }
      >
        This removes {history.length} record{history.length === 1 ? '' : 's'} from this browser.
        Your images were never stored, so there is nothing else to delete.
      </Modal>
    </div>
  );
}
