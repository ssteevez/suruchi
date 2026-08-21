/** One text-based work with its own interaction, mounted into a shared shell. */
export interface TextWorkModule {
  title: string;
  mount(container: HTMLElement): () => void;
}

export interface WorkEntry {
  slug: string;
  title: string;
  load: () => Promise<{ default: TextWorkModule }>;
}
