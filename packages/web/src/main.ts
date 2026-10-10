import './style.css';
import { initUI } from './ui';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');
initUI(app);
