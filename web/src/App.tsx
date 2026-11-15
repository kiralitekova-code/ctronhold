import { useEffect, useRef, useState } from "react";
import { GameRenderer } from "./rendering/game-renderer";
import { GameHUD } from "./ui/GameHUD";

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const renderer = new GameRenderer(host.current);
    let frame = 0;
    let previous = 0;
    let alive = true;

    const loop = (now: number) => {
      if (!alive) return;
      const dt = previous === 0 ? 0 : Math.min((now - previous) / 1000, 0.1);
      previous = now;
      renderer.update(dt);
      renderer.render();
      frame = requestAnimationFrame(loop);
    };

    renderer.initialize().then(() => {
      if (!alive) return;
      setReady(true);
      frame = requestAnimationFrame(loop);
    }).catch(console.error);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      renderer.dispose();
    };
  }, []);

  return <main className="game-shell">
    <div ref={host} className="viewport" />
    <GameHUD ready={ready} />
  </main>;
}
