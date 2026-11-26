import '../../css/desktop-updates.css';
import { mountDesktopUpdatePanel } from './desktop-update-panel.js';

const panel = document.getElementById('homeBuildVersion')
  ? mountDesktopUpdatePanel(document, window.brfutDesktop?.updates)
  : null;
if (panel) window.addEventListener('pagehide', () => panel.dispose(), { once: true });
