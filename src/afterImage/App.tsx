import React from 'react';
import Carousel from './components/Carousel';
import { initialImages } from './data/images';

function App() {
  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#050505', overflow: 'hidden' }}>
      <Carousel images={initialImages} />
      
      <header className="header-container">
        <h1 className="header-title">Alterego:<br/>Afterimage</h1>
        <div className="header-desc">
          <p>Alterego speaks to duality: the self we present to the world and the other self that lives parallel to it — sometimes in conflict, sometimes in harmony. Afterimage reminds us that perception is not static. What we see first is only the beginning. Stare long enough, and something else surfaces: a trace of childhood wonder, a suppressed dream, an inherited wound, an unexpected tenderness.</p>
          <p>Each work is a portrait of someone significant in my life — a friend, a family member, a mentor, or a fleeting yet unforgettable presence. I begin with their recognizable likeness, rendered with care and intimacy. But the true subject emerges through layered techniques that suggest a second presence beneath or beside the first. Features blur, dissolve, reassemble. What remains when the everyday mask slips is not a fuller likeness, but a different one.</p>
          <p>These are relational portraits. Not who these people are, but how they live inside me — carrying the quiet vulnerabilities and radiant strengths I have been permitted to see, and some I may have imagined. Closeness, I have found, does not reveal more of a person so much as more versions of them. The surface gives way to something less stable, more porous. Sometimes I recognize the person I began with. Sometimes I don't. Sometimes what comes into focus feels uncomfortably close to myself.</p>
          <p>I wonder whether we can ever fully know someone. Or ourselves, for that matter.</p>
          <p>These portraits ask viewers to stay with complexity rather than clarity — to look until the first face gives way.</p>
        </div>
      </header>

      <a className="back-btn" href="/painter.html" aria-label="Back to Painter">BACK</a>

      {/* Navigation Instruction Footer */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '0',
        width: '100%',
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: '11px',
        letterSpacing: '0.05em',
        fontFamily: '"Neue Haas Grotesk Text Pro", -apple-system, sans-serif',
        pointerEvents: 'none',
        zIndex: 50
      }}>
        Scroll, drag, or use arrow keys to navigate
      </div>
    </div>
  );
}

export default App;
