import './style.css';

import Application from './Application/Application';

const app: Application = new Application();
(window as any)._app = app;

// Integrated stats.js performance profiling
