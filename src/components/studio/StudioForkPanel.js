'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dice5, X } from 'lucide-react';
import { forkNodes } from '@/lib/studio/api.js';
import { formatValue, getFamilyKnobs, matchWords } from '@/lib/studio/knobs.js';
import KnobScrubber from './KnobScrubber.js';

const getBranchImageIds = (project, parent) => {
  const nodesById = new Map(project.nodes.map((node) => [node.id, node]));
  const imageIds = new Set();
  let node = parent;

  while (node) {
    if (node.imageId) {
      imageIds.add(node.imageId);
    }
    node = node.parentId ? nodesById.get(node.parentId) ?? null : null;
  }

  for (const child of project.nodes) {
    if (child.parentId === parent.id && child.imageId) {
      imageIds.add(child.imageId);
    }
  }

  return [...imageIds];
};

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

export default function StudioForkPanel({
  project,
  parent,
  family,
  previewRef,
  previewPortalTarget,
  footerPortalTarget,
  dispatch,
  onMessage,
}) {
  const knobs = useMemo(() => getFamilyKnobs(family).filter((knob) => knob.stops.length > 1), [family]);
  const usedImageIds = useMemo(() => getBranchImageIds(project, parent), [parent, project]);
  const usedImageSet = useMemo(() => new Set(usedImageIds), [usedImageIds]);
  const [armed, setArmed] = useState(null);
  const [forkMode, setForkMode] = useState('single');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState(parent.settings?.seed ?? 1);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const resetTokenRef = useRef(0);
  const controllerRef = useRef(null);
  const previewChipRef = useRef(null);
  const previewLabelRef = useRef(null);
  const lastRequestRef = useRef(null);
  const forkRef = useRef(null);
  const canForkRef = useRef(false);

  const textMatches = useMemo(() => matchWords(prompt, family), [family, prompt]);
  const textMode = prompt.trim().length > 0;
  const armedKnob = armed ? knobs.find((knob) => knob.knob === armed.knob) : null;
  const armedStop = armedKnob?.stops[armed.index] ?? null;
  const parentValue = (knob) => parent.knobs?.[knob.knob] ?? 'original';
  const getSelectedIndex = (knob) => {
    if (armed?.knob === knob.knob) {
      return armed.index;
    }
    const index = knob.stops.findIndex((stop) => stop.value === parentValue(knob));
    return index >= 0 ? index : 0;
  };
  const getDisabledIndexes = (knob) =>
    knob.stops.reduce((indexes, stop, index) => {
      if (!stop.image || usedImageSet.has(stop.image.id) || stop.value === parentValue(knob)) {
        indexes.push(index);
      }
      return indexes;
    }, []);

  const armedParentValue = armedKnob ? parentValue(armedKnob) : null;
  const availableValues = useMemo(
    () =>
      armedKnob
        ? armedKnob.stops
            .filter(
              (stop) =>
                stop.image &&
                !usedImageSet.has(stop.image.id) &&
                stop.value !== armedParentValue,
            )
            .map((stop) => stop.value)
        : [],
    [armedKnob, armedParentValue, usedImageSet],
  );

  const canFork = textMode
    ? !forking
    : Boolean(armed && armedStop && armedStop.value !== parentValue(armedKnob) && availableValues.includes(armedStop.value) && !forking);
  canForkRef.current = canFork;

  useEffect(() => {
    if (!textMode) {
      return;
    }

    if (textMatches.length > 0) {
      setAnnouncement(
        textMatches
          .map((match) => `${formatValue(match.knob)}: ${formatValue(match.value)}`)
          .join(', '),
      );
    } else {
      setAnnouncement('No style keywords recognized. Similar variations will be created.');
    }
  }, [textMatches, textMode]);

  const clearArmed = useCallback(() => {
    const hadPreview = Boolean(armed || (previewChipRef.current && !previewChipRef.current.hidden));
    setArmed(null);
    setAnnouncement(hadPreview ? 'Preview cleared.' : '');
    resetTokenRef.current += 1;
    previewRef.current?.clear();
    if (previewChipRef.current) {
      previewChipRef.current.hidden = true;
    }
  }, [armed, previewRef]);

  const activateKnob = (knob) => {
    previewRef.current?.preload(knob);
  };

  const showScrubPreview = (knob, position) => {
    previewRef.current?.showProgress(knob, position);
    const entry = knobs.find((item) => item.knob === knob);
    const stop = entry?.stops[Math.round(position)];
    if (stop && previewChipRef.current && previewLabelRef.current) {
      previewChipRef.current.hidden = false;
      const label = `Preview: ${entry.label} - ${stop.label}`;
      if (previewLabelRef.current.textContent !== label) {
        previewLabelRef.current.textContent = label;
      }
    }
  };

  const commitKnob = (knobName, index) => {
    const knob = knobs.find((entry) => entry.knob === knobName);
    const stop = knob?.stops[index];
    if (!stop || getDisabledIndexes(knob).includes(index)) {
      clearArmed();
      return;
    }

    const switchingKnobs = armed && armed.knob !== knobName;
    setArmed({ knob: knobName, index });
    if (switchingKnobs) {
      setForkMode('single');
    }
    setAnnouncement(
      switchingKnobs
        ? 'Only one knob can be armed at a time.'
        : `${knob.label}: ${stop.label} armed.`,
    );
    previewRef.current?.showValue(knobName, stop.value);
  };

  const makeRequest = useCallback(
    async (request) => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      lastRequestRef.current = request;
      setError('');
      setAnnouncement('Creating variation.');
      setForking(true);

      try {
        const result = await forkNodes(request, { signal: controller.signal });
        if (!result || controller.signal.aborted) {
          return;
        }

        if (result.nodes?.length) {
          dispatch({
            type: 'ADD_FORKED_NODES',
            payload: { projectId: project.id, nodes: result.nodes },
          });
          const message = `${result.nodes.length} variation${result.nodes.length === 1 ? '' : 's'} created.`;
          setAnnouncement(message);
          onMessage(message);
          setArmed(null);
          resetTokenRef.current += 1;
          previewRef.current?.clear();
        } else {
          const message = result.message ?? 'No more variations in this sample project';
          setAnnouncement(message);
          onMessage(message);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          const message = requestError instanceof Error ? requestError.message : 'The fork failed. Please retry.';
          setError(message);
          setAnnouncement(message);
        }
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setForking(false);
        }
      }
    },
    [dispatch, onMessage, previewRef, project.id],
  );

  const handleFork = useCallback(async () => {
    if (!canForkRef.current) {
      return;
    }

    const basePayload = {
      projectId: project.id,
      familyId: project.familyId,
      parent,
      usedImageIds,
      seed: Number.isFinite(Number(seed)) ? Number(seed) : 1,
    };
    const request = textMode
      ? { ...basePayload, prompt: prompt.trim(), count: Number(count) }
      : {
          ...basePayload,
          knob: armed.knob,
          values: forkMode === 'all' ? availableValues : [armedStop.value],
        };

    await makeRequest(request);
  }, [
    project,
    parent,
    usedImageIds,
    seed,
    textMode,
    prompt,
    count,
    armed,
    forkMode,
    availableValues,
    armedStop,
    makeRequest,
  ]);
  forkRef.current = handleFork;

  const cancelFork = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setForking(false);
    setError('');
    setAnnouncement('');
    onMessage('');
  };

  useEffect(() => {
    if (parent.settings?.seed !== undefined) {
      setSeed(parent.settings.seed);
    }
  }, [parent.id, parent.settings?.seed]);

  useEffect(() => {
    setArmed(null);
    setError('');
    setAnnouncement('');
    resetTokenRef.current += 1;
    previewRef.current?.clear();
    controllerRef.current?.abort();
    setForking(false);
  }, [family.id, parent.id, previewRef, project.id]);

  useEffect(() => {
    const preview = previewRef.current;
    const handleShortcut = (event) => {
      if (
        event.key.toLowerCase() !== 'f' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        event.target?.isContentEditable
      ) {
        return;
      }

      if (canForkRef.current) {
        event.preventDefault();
        forkRef.current?.();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      controllerRef.current?.abort();
      preview?.clear();
    };
  }, [previewRef]);

  return (
    <section
      className="studio-fork-panel"
      aria-labelledby="studio-fork-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && armed) {
          event.preventDefault();
          event.stopPropagation();
          clearArmed();
        }
      }}
    >
      <div className="studio-fork-panel__header">
        <div>
          <h2 id="studio-fork-title">Fork a variation</h2>
          <p>Drag a track to preview, release to arm, then fork.</p>
        </div>
        {armed && armedStop ? (
          <span className="studio-fork-panel__armed-chip">
            <span>{formatValue(armed.knob)}: {armedStop.label}</span>
            <button type="button" onClick={clearArmed} aria-label="Clear armed knob">
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>

      <div className="studio-fork-panel__knobs">
        {knobs.map((knob) => {
          const currentValue = parentValue(knob);
          const parentIndex = knob.stops.findIndex((stop) => stop.value === currentValue);
          const knobWithParent = { ...knob, parentIndex: Math.max(parentIndex, 0) };
          return (
            <KnobScrubber
              key={`${project.id}:${parent.id}:${knob.knob}`}
              knob={knobWithParent}
              stops={knob.stops}
              selectedIndex={getSelectedIndex(knob)}
              disabledIndexes={getDisabledIndexes(knob)}
              resetToken={resetTokenRef.current}
              isArmed={armed?.knob === knob.knob}
              onActivate={activateKnob}
              onScrub={showScrubPreview}
              onCommit={commitKnob}
              onClear={clearArmed}
            />
          );
        })}
      </div>

      {armed ? (
        <div className="studio-fork-panel__modes" role="group" aria-label="Fork mode">
          <button type="button" aria-pressed={forkMode === 'single'} onClick={() => setForkMode('single')}>
            This value
          </button>
          <button type="button" aria-pressed={forkMode === 'all'} onClick={() => setForkMode('all')}>
            All values
          </button>
        </div>
      ) : null}

      <div className="studio-fork-panel__text">
        <label htmlFor="studio-fork-prompt">Or describe the change</label>
        <input
          id="studio-fork-prompt"
          type="text"
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setError('');
          }}
          placeholder="Try night, watercolor, or snow"
        />
        {textMatches.length ? (
          <div className="studio-fork-panel__chips" aria-label="Recognized changes">
            {textMatches.map((match, index) => (
              <span key={`${match.knob}:${match.value}:${match.word}:${index}`}>
                {formatValue(match.knob)}: {formatValue(match.value)}
              </span>
            ))}
          </div>
        ) : null}
        {textMode && textMatches.length === 0 ? (
          <p className="studio-fork-panel__hint">No style keywords recognized. Similar variations will be created.</p>
        ) : null}
        {textMode ? (
          <label className="studio-fork-panel__count">
            <span>Variations</span>
            <input
              type="number"
              min="1"
              max="4"
              step="1"
              value={count}
              onChange={(event) => setCount(Math.min(4, Math.max(1, Number(event.target.value) || 1)))}
            />
          </label>
        ) : null}
      </div>

      <label className="studio-fork-panel__seed">
        <span>Seed</span>
        <input
          type="number"
          min="0"
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
        />
        <button type="button" onClick={() => setSeed(randomSeed())} aria-label="Randomize fork seed">
          <Dice5 size={16} aria-hidden="true" />
        </button>
      </label>

      <p className="studio-visually-hidden" role="status" aria-live="polite">{announcement}</p>
      {footerPortalTarget
        ? createPortal(
            <div className="studio-fork-panel__actions">
              <button type="button" onClick={handleFork} disabled={!canFork}>
                {forking
                  ? 'Forking…'
                  : !canFork
                    ? 'Arm a knob to fork'
                    : `Fork ${textMode ? count : forkMode === 'all' ? availableValues.length : 1} variation${(textMode ? count : forkMode === 'all' ? availableValues.length : 1) === 1 ? '' : 's'}`}
              </button>
              {forking ? <button type="button" onClick={cancelFork}>Cancel</button> : null}
              {error ? (
                <>
                  <p role="alert">{error}</p>
                  <button type="button" onClick={() => lastRequestRef.current && makeRequest(lastRequestRef.current)}>
                    Retry
                  </button>
                </>
              ) : null}
            </div>,
            footerPortalTarget,
          )
        : null}
      {previewPortalTarget
        ? createPortal(
            <div
              ref={previewChipRef}
              className="studio-stage-preview-chip"
              hidden={!armed}
              role="group"
              aria-label="Stage preview"
            >
              <span ref={previewLabelRef} aria-live="polite">
                {armed && armedStop
                  ? `Preview: ${armedKnob.label} - ${armedStop.label}`
                  : ''}
              </span>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={clearArmed}
                aria-label="Clear stage preview"
              >
                Clear
              </button>
            </div>,
            previewPortalTarget,
          )
        : null}
    </section>
  );
}
