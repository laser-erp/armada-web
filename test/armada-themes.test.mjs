/**
 * Темы кабинета (шаг 2): armadaThemeVars, onColor, staging-only ?theme=
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, it } from 'node:test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function themeSandbox(host, search) {
  const sandbox = {
    globalThis: {},
    URLSearchParams,
    location: { hostname: host, search: search || '' },
    document: {
      documentElement: {
        style: { setProperty() {} },
        setAttribute() {},
        removeAttribute() {},
        getAttribute() {
          return null;
        },
      },
      createElement() {
        return { rel: '', href: '' };
      },
      head: { appendChild() {} },
    },
  };
  sandbox.window = sandbox.globalThis;
  return sandbox;
}

function loadThemes(host = 'localhost', search = '') {
  const code = readFileSync(path.join(root, 'themes.js'), 'utf8');
  const sandbox = themeSandbox(host, search);
  vm.runInNewContext(code, sandbox);
  return sandbox.globalThis;
}

describe('armada themes (шаг 2)', () => {
  it('onColor: светлый акцент F5C400 → тёмный текст на кнопке', () => {
    const g = loadThemes();
    assert.equal(g.armadaOnColor('#F5C400'), '#17181B');
    const vars = g.armadaThemeVars({ accent: '#F5C400', menuBg: '#1E1F22', bg: '#F3F3F1', surface: '#FFFFFF', font: 'Onest', head: 'Onest', radius: 10 });
    assert.equal(vars['--on-accent'], '#17181B');
  });

  it('onColor: тёмный акцент E01F26 → светлый текст', () => {
    const g = loadThemes();
    assert.equal(g.armadaOnColor('#E01F26'), '#FFFFFF');
  });

  it('night/light: контраст полей (текст ≥4.5, рамка ≥3)', () => {
    const g = loadThemes();
    for (const id of ['night', 'light']) {
      const preset = g.armadaThemePresetFromId(id);
      const vars = g.armadaThemeVars(preset);
      assert.ok(g.armadaContrast(vars['--text'], vars['--field']) >= 4.5, id + ' text/field');
      assert.ok(g.armadaContrast(vars['--muted'], vars['--field']) >= 4.5, id + ' muted/field');
      assert.ok(g.armadaContrast(vars['--border'], vars['--field']) >= 3, id + ' border/field');
    }
  });

  it('armadaThemeVars: контраст ссылки при слабом акценте на тёмной surface', () => {
    const g = loadThemes();
    const night = g.armadaThemePresetFromId('night');
    const vars = g.armadaThemeVars(night);
    assert.equal(vars['--bg0'], '#121214');
    assert.ok(vars['--link'] === night.accent || vars['--link'] === '#ECECEE');
  });

  it('?theme= игнорируется вне staging/localhost', () => {
    const code = readFileSync(path.join(root, 'themes.js'), 'utf8');
    const sandbox = themeSandbox('app.armada.sx', '?theme=night');
    vm.runInNewContext(code, sandbox);
    assert.equal(sandbox.globalThis.armadaParseThemeQuery(), null);
  });

  it('armadaResolvePortalCarrierSpace: slug из URL /z/', () => {
    const code = readFileSync(path.join(root, 'themes.js'), 'utf8');
    const sandbox = themeSandbox('armada-theme.localtest.me', '');
    sandbox.location.pathname = '/z/theme-step3/';
    sandbox.state = {
      spaces: [{ id: 'sp1', portalSlug: 'theme-step3', theme: { preset: 'night' } }],
    };
    sandbox.findSpaceByPortalSlug = (slug) =>
      sandbox.state.spaces.find((s) => String(s.portalSlug).toLowerCase() === String(slug).toLowerCase()) || null;
    sandbox.findSpaceById = (id) => sandbox.state.spaces.find((s) => s.id === id) || null;
    sandbox.readPortalScopeFromUrl = () => ({ portalSlug: 'theme-step3' });
    sandbox.getPortalScope = () => ({ portalSlug: 'theme-step3' });
    vm.runInNewContext(code, sandbox);
    const sp = sandbox.globalThis.armadaResolvePortalCarrierSpace();
    assert.ok(sp);
    assert.equal(sp.id, 'sp1');
  });

  it('?theme=night на localhost — пресет применяется', () => {
    const g = loadThemes('localhost', '?theme=night');
    const preset = g.armadaParseThemeQuery();
    assert.ok(preset);
    assert.equal(preset.bg, '#121214');
  });

  it('armadaSuggestReadableAccent: слабый акцент на светлой surface', () => {
    const g = loadThemes();
    const next = g.armadaSuggestReadableAccent('#F5C400', '#FFFFFF');
    assert.ok(g.armadaContrast(next, '#FFFFFF') >= 4.5);
  });

  it('armadaButtonContrastLabel: #157A4A читается на кнопке', () => {
    const g = loadThemes();
    const lbl = g.armadaButtonContrastLabel('#157A4A');
    assert.equal(lbl.ok, true);
    assert.equal(lbl.text, 'читается');
  });

  it('defaultSpaceThemeConfig: пресет light по умолчанию', () => {
    const g = loadThemes();
    assert.equal(g.defaultSpaceThemeConfig().preset, 'light');
    const preset = g.armadaApplyDefaultAppTheme();
    assert.ok(preset);
    assert.equal(preset.bg, '#FFFFFF');
  });

  it('16 пресетов студии: id, note, brutal и minimal', () => {
    const g = loadThemes();
    assert.equal(g.ARMADA_THEME_IDS.length, 16);
    const brutal = g.armadaThemePresetFromId('brutal');
    assert.ok(brutal);
    assert.equal(brutal.font, 'IBM Plex Mono');
    assert.equal(brutal.bw, 2);
    const minimal = g.armadaThemePresetFromId('minimal');
    assert.ok(minimal);
    assert.equal(minimal.name, 'Минимал');
    const graphite = g.ARMADA_THEMES.graphite;
    assert.ok(graphite.note);
    assert.equal(graphite.layout, 'kanban');
  });
});
