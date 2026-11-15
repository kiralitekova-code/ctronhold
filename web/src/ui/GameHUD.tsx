export function GameHUD({ ready }: { ready: boolean }) {
  return <header className="hud">
    <strong>CTRONHOLD</strong>
    <span>Дерево 0</span><span>Камень 0</span><span>Железо 0</span><span>Золото 0</span>
    <span className="status">{ready ? "СИМУЛЯЦИЯ ГОТОВА" : "ЗАГРУЗКА WASM…"}</span>
    <small>WASD / края экрана — камера · Колесо — масштаб · ПКМ — перемещение</small>
  </header>;
}
