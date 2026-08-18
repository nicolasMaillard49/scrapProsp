import test from "node:test";
import assert from "node:assert/strict";
import { appShellOffsetCss } from "./appShell";

test("appShellOffsetCss décale toute la page, pas seulement son main", () => {
  const css = appShellOffsetCss(true);

  assert.match(css, /\.app-shell-content\s*\{\s*padding-bottom:\s*96px/);
  assert.match(css, /min-width:\s*900px[\s\S]*\.app-shell-content\s*\{\s*padding-left:\s*84px/);
  assert.match(css, /min-width:\s*1200px[\s\S]*\.app-shell-content\s*\{\s*padding-left:\s*280px/);
  assert.doesNotMatch(css, /(^|[}\s])main\s*\{/m);
});

test("appShellOffsetCss garde le rail simple sans réserver la navigation contextuelle", () => {
  const css = appShellOffsetCss(false);

  assert.match(css, /padding-left:\s*84px/);
  assert.doesNotMatch(css, /padding-left:\s*280px/);
});
