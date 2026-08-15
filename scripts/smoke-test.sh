#!/usr/bin/env bash
# ============================================================================
# dsh-no-setup-mode 冒煙測試
# 用法：bash scripts/smoke-test.sh
# 檢查：bundle 語法與結構、名稱一致性（MODE/package/patch）、以及（若 DSH
# 正在運行）boot manifest 與端點。任何一項失敗即 exit 1。
# ============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_URL="${DSH_URL:-http://127.0.0.1:3080}"
FAILED=0

fail() { echo "❌ $1"; FAILED=1; }
ok()   { echo "✅ $1"; }

echo "== dsh-no-setup-mode smoke test =="

# 1. bundle 語法
if node --check "$ROOT/lib/index.js" 2>/dev/null; then ok "host bundle syntax"; else fail "host bundle syntax"; fi
if node --check "$ROOT/lib/client.js" 2>/dev/null; then ok "client bundle syntax"; else fail "client bundle syntax"; fi

# 2. MODE code（從 host 導出讀取）
CODE="$(node --input-type=module -e "import('$ROOT/lib/index.js').then(m => console.log(m.MODE.code))" 2>/dev/null)"
if [ -z "$CODE" ]; then fail "cannot read MODE.code from lib/index.js"; else ok "MODE.code = $CODE"; fi

# 3. client bundle 結構：MODE 必須定義在 load 呼叫之前；bundle id 必須為 dsh-<code>
MODE_LINE="$(grep -n 'const MODE = {' "$ROOT/lib/client.js" | head -1 | cut -d: -f1)"
LOAD_LINE="$(grep -n '^window.__ModuleLoader__.load' "$ROOT/lib/client.js" | head -1 | cut -d: -f1)"
if [ -n "$MODE_LINE" ] && [ -n "$LOAD_LINE" ] && [ "$MODE_LINE" -lt "$LOAD_LINE" ]; then
  ok "client MODE defined before load ($MODE_LINE < $LOAD_LINE)"
else
  fail "client MODE must be defined before __ModuleLoader__.load"
fi
if grep -q 'id: `dsh-\${MODE.code}`' "$ROOT/lib/client.js"; then
  ok "client bundle id = dsh-\$MODE.code"
else
  fail "client bundle id must be \`dsh-\${MODE.code}\` (loader matches package name)"
fi

# 4. package.json name 一致性（必須等於 dsh-<code>）
NAME="$(node -e "console.log(require('$ROOT/package.json').name)" 2>/dev/null)"
if [ "$NAME" = "dsh-$CODE" ]; then ok "package name = $NAME"; else fail "package name $NAME != dsh-$CODE"; fi

# 5. cordis.patch.yml id 一致性（必須等於 code）
PATCH_ID="$(grep -oP 'id:\s*\K[a-z0-9-]+' "$ROOT/cordis.patch.yml" | head -1)"
if [ "$PATCH_ID" = "$CODE" ]; then ok "patch id = $PATCH_ID"; else fail "patch id $PATCH_ID != $CODE"; fi

# 6. 端點路徑一致性（client fetch 使用與 host 相同的 /<code>/ 前綴）
if grep -q "fetch(\`/\${MODE.code}/balance\`" "$ROOT/lib/client.js" \
  && grep -q "fetch(\`/\${MODE.code}/model\`" "$ROOT/lib/client.js" \
  && grep -q "fetch(\`/\${MODE.code}/access\`" "$ROOT/lib/client.js" \
  && grep -q "fetch(\`/\${MODE.code}/persona" "$ROOT/lib/client.js"; then
  ok "client endpoint paths use /<code>/ prefix"
else
  fail "client endpoint paths must use /<code>/ prefix"
fi

# 7. 人設狀態檔（若存在必須是合法 JSON）
PERSONA_FILE="$HOME/.dsh/.$CODE-persona.json"
if [ -f "$PERSONA_FILE" ]; then
  if node -e "JSON.parse(require('fs').readFileSync('$PERSONA_FILE','utf8'))" 2>/dev/null; then
    ok "persona state file is valid JSON"
  else
    fail "persona state file $PERSONA_FILE is not valid JSON"
  fi
else
  echo "ℹ️  persona state file not present yet (created on first persona selection)"
fi

# 8. 運行中的 DSH 檢查（可選）
if curl -sf -m 3 "$DSH_URL/" > /dev/null 2>&1; then
  echo "— DSH is running at $DSH_URL —"
  if curl -s "$DSH_URL/" | grep -q '"id":"dsh-no-setup-mode"'; then
    ok "boot manifest contains plugin"
  else
    fail "plugin missing from boot manifest (restart DSH?)"
  fi
  BALANCE="$(curl -s -m 12 "$DSH_URL/$CODE/balance")"
  if echo "$BALANCE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);if(j.ok===true&&Array.isArray(j.balances))process.exit(0)}catch(e){}process.exit(1)})" 2>/dev/null; then
    ok "balance endpoint"
  else
    fail "balance endpoint (got: ${BALANCE:0:80})"
  fi
  if curl -s "$DSH_URL/$CODE/persona?sessionId=smoke-test" | grep -q '"ok":true'; then
    ok "persona endpoint"
  else
    fail "persona endpoint"
  fi
else
  echo "⚠️  DSH not running — skipped live endpoint checks"
fi

echo
if [ "$FAILED" -eq 0 ]; then
  echo "== smoke test passed =="
  exit 0
else
  echo "== smoke test FAILED =="
  exit 1
fi
