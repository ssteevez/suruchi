import * as THREE from 'three';

export type PageResolution = 1200 | 2400;

export interface TextureData {
  tex: THREE.Texture;
  res: PageResolution;
}

class TextureManagerSystem {
  private cache = new Map<number, TextureData>();
  private subscribers = new Map<number, Set<(data: TextureData | null) => void>>();
  private abortControllers = new Map<string, AbortController>();
  private textureLoader = new THREE.TextureLoader();

  private getUrl(index: number, res: PageResolution) {
    if (index === 0) return res === 1200 ? '/images/Book/cover.jpg' : '/images/Book/cover-2400.jpg';
    return res === 1200 ? `/images/Book/${index}.jpg` : `/images/Book/${index}-2400.jpg`;
  }

  public subscribe(index: number, callback: (data: TextureData | null) => void) {
    if (!this.subscribers.has(index)) this.subscribers.set(index, new Set());
    this.subscribers.get(index)!.add(callback);
    
    if (this.cache.has(index)) {
      callback(this.cache.get(index)!);
    } else {
      callback(null);
    }
    
    return () => {
      this.subscribers.get(index)?.delete(callback);
    };
  }

  private notify(index: number) {
    const data = this.cache.get(index) || null;
    const cbs = this.subscribers.get(index);
    if (cbs) {
      cbs.forEach(cb => cb(data));
    }
  }

  public async requestLoad(index: number, res: PageResolution) {
    const current = this.cache.get(index);
    if (current && current.res >= res) return; // Already have this resolution or better

    const reqId = `${index}-${res}`;
    if (this.abortControllers.has(reqId)) return; // Already loading this exact resolution
    
    const ac = new AbortController();
    this.abortControllers.set(reqId, ac);

    const url = this.getUrl(index, res);

    try {
      const tex = await new Promise<THREE.Texture>((resolve, reject) => {
        this.textureLoader.load(
          url,
          (t) => {
            if (ac.signal.aborted) {
              t.dispose();
              reject(new Error('Aborted'));
              return;
            }
            resolve(t);
          },
          undefined,
          (err) => reject(err)
        );
      });
      
      if (ac.signal.aborted) {
         tex.dispose();
         return;
      }
      
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      
      // Dispose old texture if we are replacing it
      if (this.cache.has(index)) {
        this.cache.get(index)!.tex.dispose();
      }
      
      this.cache.set(index, { tex, res });
      this.notify(index);
      
    } catch (e) {
      // Ignore abort errors
    } finally {
      this.abortControllers.delete(reqId);
    }
  }

  public cancelAllResolutions(res: PageResolution) {
     for (const [reqId, ac] of this.abortControllers.entries()) {
        if (reqId.endsWith(`-${res}`)) {
           ac.abort();
           this.abortControllers.delete(reqId);
        }
     }
  }

  public dispose(index: number) {
    // Cancel any pending requests for this page
    this.abortControllers.get(`${index}-1200`)?.abort();
    this.abortControllers.get(`${index}-2400`)?.abort();
    this.abortControllers.delete(`${index}-1200`);
    this.abortControllers.delete(`${index}-2400`);
    
    if (this.cache.has(index)) {
      this.cache.get(index)!.tex.dispose();
      this.cache.delete(index);
      this.notify(index); // Notify subscribers it was removed (they will get null)
    }
  }
  
  public getDebugInfo() {
    let textures1200 = 0;
    let textures2400 = 0;
    let activeIndices: string[] = [];
    
    for (const [idx, data] of this.cache.entries()) {
       if (data.res === 1200) textures1200++;
       if (data.res === 2400) textures2400++;
       activeIndices.push(`P${idx}(${data.res === 2400 ? 'H' : 'L'})`);
    }
    
    let pendingIndices: string[] = [];
    for (const reqId of this.abortControllers.keys()) {
       pendingIndices.push(reqId.replace('-', '(') + ')');
    }

    return { 
      totalActive: this.cache.size, 
      textures1200, 
      textures2400, 
      pending: this.abortControllers.size,
      activeList: activeIndices.join(', '),
      pendingList: pendingIndices.join(', ')
    };
  }
}

export const TextureManager = new TextureManagerSystem();
