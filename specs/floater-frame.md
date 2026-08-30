# Floater Frame (Gallery Standard)

A reusable architectural setup for rendering physical gallery-grade "floater frames" across the site. A floater frame makes the artwork look like a stretched canvas sitting inside a thin wooden box, with a recessed dark gap separating the artwork from the frame.

## Structure
Requires a parent container for the frame and void, and a child element (usually an `img` or `<picture>`) for the artwork.

### 1. The Frame & Void (Parent Container)
```css
.frame-container {
  box-sizing: border-box;
  display: block; /* or flex */
  
  /* The thin exterior wood frame */
  border: 2px solid #8e6345; 
  
  /* The dynamic, directionally-lit grey void (simulates top-left lighting) */
  background: linear-gradient(135deg, #555 0%, #1a1a1a 100%); 
  
  /* 
    Outer shadow: grounds the frame on the gallery wall
    Inner shadow: creates depth for the recessed void
  */
  box-shadow: 4px 8px 20px rgba(0,0,0,0.3), inset 2px 4px 10px rgba(0,0,0,0.5); 
  
  /* The physical width of the dark gap */
  padding: 4px; 
}
```

### 2. The Canvas (Child Element)
```css
.canvas-artwork {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  
  /* The shadow the stretched canvas casts into the dark void */
  box-shadow: 1px 2px 6px rgba(0,0,0,0.9);
}
```
