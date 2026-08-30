import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        bio: 'bio.html',
        contact: 'contact.html',
        pilgrim: 'pilgrim.html',
        poet: 'poet.html',
        painter: 'painter.html',
        zeroPlus: 'zero-plus.html',
        afterImage: 'after-image.html',
        afterburn: 'experiments/afterburn/index.html',
        beachShooting: 'experiments/beach-shooting/index.html',
        euphemisims: 'experiments/euphemisims/index.html',
        euphemisimsWork: 'experiments/euphemisims/work.html',
        bookEngine: 'experiments/book-engine/index.html',
        cardStack: 'experiments/card-stack/index.html',
        iWasNotAmong: 'i-was-not-among.html',
        admin: 'suruchi-admin/index.html',
      },
    },
  },
});
