'use client';

import Image from 'next/image';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { getFamilyKnobs } from '@/lib/studio/knobs.js';

const PreviewLayer = forwardRef(function PreviewLayer({ family, imageId }, ref) {
  const layerRef = useRef(null);
  const knobs = useMemo(() => getFamilyKnobs(family), [family]);
  const imageEntries = useMemo(
    () =>
      knobs.flatMap((knob) =>
        knob.stops.map((stop) => ({
          knob: knob.knob,
          value: stop.value,
          image: stop.image,
        })),
      ),
    [knobs],
  );
  const knobEntries = useMemo(() => new Map(knobs.map((knob) => [knob.knob, knob])), [knobs]);

  const setOpacities = useCallback(
    (entries) => {
      const layer = layerRef.current;
      if (!layer) {
        return;
      }

      imageEntries.forEach((entry, index) => {
        layer.style.setProperty(
          `--studio-preview-opacity-${index}`,
          String(entries.get(`${entry.knob}:${entry.value}`) ?? 0),
        );
      });
    },
    [imageEntries],
  );

  const showProgress = useCallback(
    (knobName, progress) => {
      const knob = knobEntries.get(knobName);
      if (!knob) {
        return;
      }

      const bounded = Math.min(knob.stops.length - 1, Math.max(0, progress));
      const lowerIndex = Math.floor(bounded);
      const upperIndex = Math.ceil(bounded);
      const fraction = bounded - lowerIndex;
      const entries = new Map([
        [`${knobName}:${knob.stops[lowerIndex].value}`, 1 - fraction],
      ]);

      if (upperIndex !== lowerIndex) {
        entries.set(`${knobName}:${knob.stops[upperIndex].value}`, fraction);
      }

      setOpacities(entries);
      layerRef.current?.classList.add('is-scrubbing');
    },
    [knobEntries, setOpacities],
  );

  const showValue = useCallback(
    (knobName, value) => {
      setOpacities(new Map([[`${knobName}:${value}`, 1]]));
      layerRef.current?.classList.remove('is-scrubbing');
    },
    [setOpacities],
  );

  const clear = useCallback(() => {
    setOpacities(new Map());
    layerRef.current?.classList.remove('is-scrubbing');
  }, [setOpacities]);

  const preload = useCallback(
    (knobName) => {
      const knob = knobEntries.get(knobName);
      if (!knob || typeof window === 'undefined') {
        return;
      }

      knob.stops.forEach((stop) => {
        if (!stop.image?.url) {
          return;
        }

        const image = new window.Image();
        image.src = stop.image.url;
        image.decode().catch(() => undefined);
      });
    },
    [knobEntries],
  );

  useImperativeHandle(
    ref,
    () => ({
      preload,
      showProgress,
      showValue,
      clear,
    }),
    [clear, preload, showProgress, showValue],
  );

  useEffect(() => {
    clear();
  }, [clear, imageId, family?.id]);

  return (
    <div ref={layerRef} className="studio-preview-layer" aria-hidden="true">
      {imageEntries.map((entry, index) =>
        entry.image ? (
          <Image
            key={`${entry.knob}:${entry.value}`}
            src={entry.image.url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 65vw"
            draggable={false}
            className="studio-preview-image"
            style={{ opacity: `var(--studio-preview-opacity-${index}, 0)` }}
          />
        ) : null,
      )}
    </div>
  );
});

PreviewLayer.displayName = 'PreviewLayer';

export default PreviewLayer;
