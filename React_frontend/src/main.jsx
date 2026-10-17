import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import './styles/global.css';
import './apps/diner/styles/app.css';

createRoot(document.getElementById('root')).render(<App />);
