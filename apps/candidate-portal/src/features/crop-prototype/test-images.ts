export interface TestImage {
  key: string;
  label: string;
  width: number;
  height: number;
  src: string;
}

const SHAPES: Array<Omit<TestImage, 'src'>> = [
  { key: 'tall', label: 'Tall — 800 × 2000', width: 800, height: 2000 },
  { key: 'portrait', label: 'Portrait — 1200 × 1600', width: 1200, height: 1600 },
  { key: 'square', label: 'Square — 1200 × 1200', width: 1200, height: 1200 },
  { key: 'wide', label: 'Wide — 3000 × 1000', width: 3000, height: 1000 },
  { key: 'tiny', label: 'Tiny — 60 × 60', width: 60, height: 60 },
  { key: 'huge', label: 'Huge — 4000 × 3000', width: 4000, height: 3000 },
];

const BLANK: TestImage = { key: 'none', label: 'No photo', width: 0, height: 0, src: '' };

let drawn: TestImage[] | null = null;

export function testImages(): TestImage[] {
  if (!drawn) drawn = SHAPES.map((shape) => ({ ...shape, src: draw(shape.width, shape.height) }));
  return drawn;
}

export function firstTestImage(): TestImage {
  const [first] = testImages();
  return first ?? BLANK;
}

function draw(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const paint = canvas.getContext('2d');
  if (!paint) return '';

  const cx = width / 2;
  const cy = height / 2;
  const unit = Math.min(width, height) / 16;

  paint.fillStyle = '#0f172a';
  paint.fillRect(0, 0, width, height);

  const quadrants = [
    ['#7f1d1d', 0, 0],
    ['#14532d', cx, 0],
    ['#1e3a8a', 0, cy],
    ['#713f12', cx, cy],
  ] as const;
  for (const [colour, x, y] of quadrants) {
    paint.fillStyle = colour;
    paint.fillRect(x, y, cx, cy);
  }

  paint.strokeStyle = '#94a3b8';
  paint.globalAlpha = 0.25;
  paint.lineWidth = Math.max(1, unit / 16);
  for (let x = 0; x <= width; x += unit) {
    paint.beginPath();
    paint.moveTo(x, 0);
    paint.lineTo(x, height);
    paint.stroke();
  }
  for (let y = 0; y <= height; y += unit) {
    paint.beginPath();
    paint.moveTo(0, y);
    paint.lineTo(width, y);
    paint.stroke();
  }
  paint.globalAlpha = 1;

  const outermost = Math.min(width, height) / 2;
  paint.lineWidth = Math.max(1, unit / 8);
  paint.strokeStyle = '#e2e8f0';
  paint.globalAlpha = 0.5;
  for (let radius = outermost; radius > 0; radius -= outermost / 8) {
    paint.beginPath();
    paint.arc(cx, cy, radius, 0, Math.PI * 2);
    paint.stroke();
  }
  paint.globalAlpha = 1;

  paint.strokeStyle = '#f43f5e';
  paint.lineWidth = Math.max(2, unit / 6);
  paint.beginPath();
  paint.moveTo(cx, cy - unit * 1.5);
  paint.lineTo(cx, cy + unit * 1.5);
  paint.moveTo(cx - unit * 1.5, cy);
  paint.lineTo(cx + unit * 1.5, cy);
  paint.stroke();

  paint.strokeStyle = '#fbbf24';
  paint.lineWidth = Math.max(2, unit / 5);
  paint.strokeRect(unit / 3, unit / 3, width - (unit * 2) / 3, height - (unit * 2) / 3);

  paint.fillStyle = '#f8fafc';
  paint.font = `bold ${unit * 0.85}px system-ui, sans-serif`;
  paint.textAlign = 'center';
  paint.fillText(`${width} × ${height}`, cx, cy - unit * 2.1);
  paint.fillText('TRUE CENTRE', cx, cy + unit * 2.7);

  paint.textAlign = 'left';
  paint.fillText('TOP-LEFT', unit * 0.9, unit * 1.8);
  paint.textAlign = 'right';
  paint.fillText('BOTTOM-RIGHT', width - unit * 0.9, height - unit);

  return canvas.toDataURL('image/png');
}
