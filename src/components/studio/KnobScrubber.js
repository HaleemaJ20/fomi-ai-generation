'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export default function KnobScrubber({
  knob,
  stops,
  selectedIndex,
  disabledIndexes,
  resetToken,
  isArmed,
  onActivate,
  onScrub,
  onCommit,
  onClear,
}) {
  const sliderRef = useRef(null);
  const trackAreaRef = useRef(null);
  const thumbRef = useRef(null);
  const readoutRef = useRef(null);
  const liveRef = useRef(null);
  const animationRef = useRef(null);
  const pendingXRef = useRef(null);
  const positionRef = useRef(selectedIndex);
  const lastAnnouncementRef = useRef(-1);
  const disabledSet = useMemo(() => new Set(disabledIndexes), [disabledIndexes]);
  const [trackWidth, setTrackWidth] = useState(0);
  const maximum = stops.length - 1;
  const visibleLabelIndexes = useMemo(() => {
    if (stops.length <= 3) {
      return stops.map((stop, index) => index);
    }

    const candidates = [...new Set([0, maximum, knob.parentIndex, isArmed ? selectedIndex : -1])];
    const visible = [];

    candidates.forEach((index) => {
      if (index < 0 || index > maximum) {
        return;
      }

      const isFarEnough = visible.every(
        (visibleIndex) => Math.abs(index - visibleIndex) * (trackWidth / maximum) >= 64,
      );
      if (isFarEnough || visible.length === 0) {
        visible.push(index);
      }
    });

    return visible;
  }, [isArmed, knob.parentIndex, maximum, selectedIndex, stops, trackWidth]);

  const setPosition = useCallback(
    (position, announce = true) => {
      const slider = sliderRef.current;
      if (!slider) {
        return;
      }

      const boundedPosition = clamp(position, 0, maximum);
      const nearestIndex = Math.round(boundedPosition);
      positionRef.current = boundedPosition;
      slider.style.setProperty('--knob-position', `${(boundedPosition / maximum) * 100}%`);
      slider.setAttribute('aria-valuenow', boundedPosition.toFixed(2));
      slider.setAttribute('aria-valuetext', `${knob.label}: ${stops[nearestIndex].label}`);

      const readout = stops[nearestIndex].value === 'original'
        ? 'Original'
        : `${knob.label}: ${stops[nearestIndex].label}`;
      if (readoutRef.current?.textContent !== readout && readoutRef.current) {
        readoutRef.current.textContent = readout;
      }

      if (announce && nearestIndex !== lastAnnouncementRef.current) {
        lastAnnouncementRef.current = nearestIndex;
        if (liveRef.current) {
          liveRef.current.textContent = `${knob.label}: ${stops[nearestIndex].label}`;
        }
      }
    },
    [knob.label, maximum, stops],
  );

  const findEnabledIndex = (index, direction = 0) => {
    let candidate = clamp(index, 0, maximum);
    if (!disabledSet.has(candidate)) {
      return candidate;
    }

    for (let distance = 1; distance <= maximum; distance += 1) {
      const candidates = direction > 0
        ? [candidate + distance, candidate - distance]
        : direction < 0
          ? [candidate - distance, candidate + distance]
          : [candidate - distance, candidate + distance];
      const available = candidates.find((value) => value >= 0 && value <= maximum && !disabledSet.has(value));
      if (available !== undefined) {
        return available;
      }
    }

    return clamp(index, 0, maximum);
  };

  const getPositionFromClientX = (clientX) => {
    const rect = sliderRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return positionRef.current;
    }

    return clamp(((clientX - rect.left) / rect.width) * maximum, 0, maximum);
  };

  const flushPointerPosition = () => {
    if (pendingXRef.current === null) {
      return;
    }

    const position = getPositionFromClientX(pendingXRef.current);
    pendingXRef.current = null;
    setPosition(position);
    onScrub(knob.knob, position);
  };

  const schedulePointerPosition = (clientX) => {
    pendingXRef.current = clientX;
    if (animationRef.current === null) {
      animationRef.current = window.requestAnimationFrame(() => {
        animationRef.current = null;
        flushPointerPosition();
      });
    }
  };

  const finishScrub = () => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    flushPointerPosition();

    const nearestIndex = findEnabledIndex(Math.round(positionRef.current));
    setPosition(nearestIndex);
    if (thumbRef.current) {
      thumbRef.current.style.transition = '';
    }
    onCommit(knob.knob, nearestIndex);
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0 || disabledSet.size === stops.length) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (thumbRef.current) {
      thumbRef.current.style.transition = 'none';
    }
    onActivate(knob.knob);
    schedulePointerPosition(event.clientX);
  };

  const handleKeyDown = (event) => {
    let nextIndex = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      nextIndex = findEnabledIndex(Math.round(positionRef.current) + direction, direction);
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = findEnabledIndex(0, 1);
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = findEnabledIndex(maximum, -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const selected = findEnabledIndex(Math.round(positionRef.current));
      setPosition(selected);
      onCommit(knob.knob, selected);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClear();
      if (isArmed) {
        event.stopPropagation();
      }
      return;
    }

    if (nextIndex !== null) {
      const boundedIndex = clamp(nextIndex, 0, maximum);
      setPosition(boundedIndex);
      onActivate(knob.knob);
      onScrub(knob.knob, boundedIndex);
    }
  };

  useEffect(() => {
    positionRef.current = selectedIndex;
    setPosition(selectedIndex, false);
  }, [resetToken, selectedIndex, setPosition]);

  useEffect(() => {
    const trackArea = trackAreaRef.current;
    if (!trackArea) {
      return undefined;
    }

    const updateTrackWidth = () => setTrackWidth(trackArea.getBoundingClientRect().width);
    const observer = new ResizeObserver(updateTrackWidth);
    observer.observe(trackArea);
    updateTrackWidth();
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }
    },
    [],
  );

  return (
    <section className="studio-knob-scrubber">
      <div className="studio-knob-scrubber__heading">
        <h3>{knob.label}</h3>
        <p>{knob.description}</p>
      </div>
      <p ref={readoutRef} className="studio-knob-scrubber__readout">
        {isArmed
          ? `${knob.label}: ${stops[selectedIndex].label}`
          : stops[selectedIndex].value === 'original'
            ? 'Original'
            : `${knob.label}: ${stops[selectedIndex].label}`}
      </p>
      <div ref={trackAreaRef} className="studio-knob-scrubber__track-area">
        <div
          ref={sliderRef}
          className="studio-knob-scrubber__track"
          role="slider"
          tabIndex={disabledSet.size === stops.length ? -1 : 0}
          aria-label={knob.label}
          aria-valuemin={0}
          aria-valuemax={maximum}
          aria-valuenow={selectedIndex}
          aria-valuetext={`${knob.label}: ${stops[selectedIndex].label}`}
          onPointerDown={handlePointerDown}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              schedulePointerPosition(event.clientX);
            }
          }}
          onPointerUp={finishScrub}
          onPointerCancel={finishScrub}
          onKeyDown={handleKeyDown}
          onFocus={() => onActivate(knob.knob)}
          onMouseEnter={() => onActivate(knob.knob)}
          style={{ '--knob-position': `${(selectedIndex / maximum) * 100}%` }}
        >
          <span className="studio-knob-scrubber__rail" />
          {stops.map((stop, index) => {
            const isDisabled = disabledSet.has(index);
            const isCurrentValue = index === knob.parentIndex;
            return (
              <span
                key={`${knob.knob}:${stop.value}`}
                className={`studio-knob-scrubber__stop ${isDisabled ? 'is-disabled' : ''} ${isCurrentValue ? 'is-current' : ''}`}
                style={{ left: `${(index / maximum) * 100}%` }}
                aria-hidden="true"
              />
            );
          })}
          <span ref={thumbRef} className="studio-knob-scrubber__thumb" aria-hidden="true" />
        </div>
        <div className="studio-knob-scrubber__stop-targets">
          {stops.map((stop, index) => {
            const isDisabled = disabledSet.has(index);
            return (
              <button
                key={`${knob.knob}:${stop.value}:target`}
                type="button"
                className={`studio-knob-scrubber__stop-target ${isDisabled ? 'is-disabled' : ''}`}
                style={{ left: `${(index / maximum) * 100}%` }}
                disabled={isDisabled}
                title={isDisabled ? 'Already used in this branch' : stop.label}
                aria-label={`${knob.label}: ${stop.label}${isDisabled ? '. Already used in this branch' : ''}`}
                onClick={() => {
                  setPosition(index);
                  onActivate(knob.knob);
                  onScrub(knob.knob, index);
                  onCommit(knob.knob, index);
                }}
              />
            );
          })}
        </div>
        <div
          className={`studio-knob-scrubber__labels ${stops.length <= 3 ? 'is-equal' : 'is-sparse'}`}
          style={{ '--stop-count': stops.length }}
        >
          {stops.map((stop, index) => {
            if (!visibleLabelIndexes.includes(index)) {
              return null;
            }

            const isCurrentValue = index === knob.parentIndex;
            return (
              <span
                key={`${knob.knob}:${stop.value}:label`}
                className={`${disabledSet.has(index) ? 'is-disabled' : ''} ${isCurrentValue ? 'is-current' : ''}`}
                style={stops.length <= 3 ? { gridColumn: index + 1 } : { left: `${(index / maximum) * 100}%` }}
              >
                {stop.label}
                {isCurrentValue ? <small>Current</small> : null}
              </span>
            );
          })}
        </div>
      </div>
      <span ref={liveRef} className="studio-visually-hidden" aria-live="polite" />
    </section>
  );
}
