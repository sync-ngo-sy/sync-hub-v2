import type { ComponentType } from 'react';
import type { Placement, Selection, SourceSquare } from './geometry';

export interface Reading {
  placement: Placement;
  selection: Selection;
  square: SourceSquare | null;
  ovalness: number;
  photo: HTMLImageElement;
}

export interface VariantProps {
  src: string;
  onReading: (reading: Reading) => void;
}

export interface Variant {
  key: string;
  name: string;
  question: string;
  Component: ComponentType<VariantProps>;
}
