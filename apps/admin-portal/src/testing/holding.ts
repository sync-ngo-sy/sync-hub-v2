export interface Holding {
  arrive: () => void;
  held: Promise<void>;
}

export function holding(): Holding {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { arrive: () => release(), held };
}
