'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import PreviewLayer from './PreviewLayer.js';

const getFittedSize = (container, image) => {
  const bounds = container.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    return null;
  }

  const scale = Math.min(bounds.width / image.width, bounds.height / image.height);
  return {
    width: Math.round(image.width * scale),
    height: Math.round(image.height * scale),
  };
};

export default function StageImageBox({ image, prompt, family, previewRef, onPreviewTarget }) {
  const containerRef = useRef(null);
  const [boxSize, setBoxSize] = useState(null);
  const setContainer = useCallback(
    (element) => {
      containerRef.current = element;
      if (element) {
        const nextSize = getFittedSize(element, image);
        if (nextSize) {
          setBoxSize(nextSize);
        }
      }
    },
    [image],
  );
  const setPreviewTarget = useCallback((element) => onPreviewTarget(element), [onPreviewTarget]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const updateSize = () => {
      const nextSize = getFittedSize(container, image);
      if (!nextSize) {
        return;
      }

      setBoxSize((current) =>
        current?.width === nextSize.width && current?.height === nextSize.height ? current : nextSize,
      );
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener('resize', updateSize);
    updateSize();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [image]);

  return (
    <div ref={setContainer} className="studio-stage-content absolute inset-0 flex items-center justify-center">
      <div
        className="studio-stage-image-box"
        style={{
          aspectRatio: `${image.width} / ${image.height}`,
          width: boxSize ? `${boxSize.width}px` : '100%',
          height: boxSize ? `${boxSize.height}px` : '100%',
        }}
      >
        <Image
          src={image.url}
          alt={prompt}
          fill
          sizes="(max-width: 768px) 100vw, 65vw"
          priority
          draggable={false}
          className="studio-stage-image"
        />
        <PreviewLayer ref={previewRef} family={family} imageId={image.id} />
        <div ref={setPreviewTarget} className="studio-stage-preview-anchor" />
      </div>
    </div>
  );
}
