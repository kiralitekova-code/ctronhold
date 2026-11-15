export function GameHUD({ ready }: { ready: boolean }) {
  return <header className="hud">
    <strong>CTRONHOLD</strong>
    <span>Дерево 0</span><span>Камень 0</span><span>Железо 0</span><span>Золото 0</span>
    <span className="status">{ready ? "ОТРЯД ГОТОВ" : "ЗАГРУЗКА WASM…"}</span>
    <small>WASD / края экрана — камера · Колесо — масштаб · ЛКМ — выбор · рамка мышью — группа · Shift — добавить · ПКМ — приказ · 1/2/3 — строй</small>
  </header>;
}
