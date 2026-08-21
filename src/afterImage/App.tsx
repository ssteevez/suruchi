import React from 'react';
import Carousel from './components/Carousel';
import { initialImages } from './data/images';

function App() {
  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#050505', overflow: 'hidden' }}>
      <Carousel images={initialImages} />
      
      <header>
        <h1 className="header-title">After Image</h1>
      </header>

      <a className="back-btn" href="/painter.html" aria-label="Back to Painter">BACK</a>
    </div>
  );
}

export default App;
