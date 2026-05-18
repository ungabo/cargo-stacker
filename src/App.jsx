import { StackingGame } from './game/StackingGame.jsx';
import { cargoTheme } from './theme/cargoTheme.js';

export default function App() {
  return (
    <main className="app-shell">
      <StackingGame theme={cargoTheme} />
    </main>
  );
}
