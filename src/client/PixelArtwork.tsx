import { useEffect, useRef, useState } from 'react';

type PixelArtworkProps = {
  src: string;
  className?: string;
  width: number;
  height: number;
  hardEdges?: boolean;
};

function PixelArtworkCanvas({ src, className, width, height, hardEdges = false }: PixelArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      setFailed(true);
      return;
    }

    let disposed = false;
    const artwork = new Image();
    artwork.onload = () => {
      if (disposed) return;
      try {
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, width, height);
        const ratio = Math.min(width / artwork.naturalWidth, height / artwork.naturalHeight);
        const drawWidth = Math.round(artwork.naturalWidth * ratio);
        const drawHeight = Math.round(artwork.naturalHeight * ratio);
        context.drawImage(artwork, Math.floor((width - drawWidth) / 2), Math.floor((height - drawHeight) / 2), drawWidth, drawHeight);
        if (hardEdges) {
          // Generated sources can retain a faint outer halo; sprites use binary alpha.
          const pixels = context.getImageData(0, 0, width, height);
          for (let index = 3; index < pixels.data.length; index += 4) {
            pixels.data[index] = pixels.data[index] >= 128 ? 255 : 0;
          }
          context.putImageData(pixels, 0, 0);
        }
      } catch {
        setFailed(true);
      }
    };
    artwork.onerror = () => {
      if (!disposed) setFailed(true);
    };
    artwork.src = src;

    return () => {
      disposed = true;
      artwork.onload = null;
      artwork.onerror = null;
    };
  }, [src, width, height, hardEdges]);

  return failed
    ? <img src={src} className={className} width={width} height={height} alt="" aria-hidden="true" draggable={false} />
    : <canvas ref={canvasRef} className={className} width={width} height={height} aria-hidden="true" />;
}

// The canvas resolution is the logical pixel grid; the caller sets its display scale.
export function PixelArtwork(props: PixelArtworkProps) {
  return <PixelArtworkCanvas key={`${props.src}:${props.width}:${props.height}:${props.hardEdges}`} {...props} />;
}
