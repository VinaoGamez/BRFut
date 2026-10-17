import '../../css/desktop-updates.css';
import { mountDesktopUpdatePanel } from './desktop-update-panel.js';

const panel = mountDesktopUpdatePanel(document, window.brfutDesktop?.updates);
if (panel) window.addEventListener('pagehide', () => panel.dispose(), { once: true });
