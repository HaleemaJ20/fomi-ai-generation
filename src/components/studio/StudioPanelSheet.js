'use client';

import { useEffect, useRef } from 'react';
import useModalScrollLock from '@/hooks/useModalScrollLock.js';

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function StudioPanelSheet({ open, title, onClose, children, isDrawer = false }) {
  const sheetRef = useRef(null);
  const closeRef = useRef(null);
  const dragRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useModalScrollLock(open);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !sheetRef.current) {
        return;
      }

      const items = Array.from(sheetRef.current.querySelectorAll(focusableSelector));
      if (!items.length) {
        event.preventDefault();
        sheetRef.current.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handlePointerDown = (event) => {
    dragRef.current = { startY: event.clientY, lastY: event.clientY, lastTime: performance.now(), velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current || !sheetRef.current) {
      return;
    }

    const now = performance.now();
    const elapsed = Math.max(now - dragRef.current.lastTime, 1);
    dragRef.current.velocity = (event.clientY - dragRef.current.lastY) / elapsed;
    dragRef.current.lastY = event.clientY;
    dragRef.current.lastTime = now;
    const offset = Math.max(0, event.clientY - dragRef.current.startY);
    sheetRef.current.style.setProperty('--st-sheet-drag-y', `${offset}px`);
    sheetRef.current.style.transition = 'none';
  };

  const finishPointerDrag = () => {
    if (!dragRef.current || !sheetRef.current) {
      return;
    }

    const offset = Math.max(0, dragRef.current.lastY - dragRef.current.startY);
    const shouldClose = offset > 80 || dragRef.current.velocity > 0.6;
    dragRef.current = null;
    sheetRef.current.style.transition = '';
    sheetRef.current.style.setProperty('--st-sheet-drag-y', '0px');
    if (shouldClose) {
      onCloseRef.current();
    }
  };

  return (
    <div
      className={`studio-sheet-backdrop ${isDrawer ? 'is-drawer' : ''}`}
      hidden={!open}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onCloseRef.current();
        }
      }}
    >
      <section
        ref={sheetRef}
        id="studio-panel-sheet"
        role="dialog"
        aria-modal={open ? 'true' : undefined}
        aria-labelledby="studio-panel-sheet-title"
        tabIndex={-1}
        className={`studio-panel-sheet ${isDrawer ? 'is-drawer' : ''}`}
      >
        <div
          className="studio-panel-sheet__grab-area"
          aria-hidden="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
        >
          <span className="studio-panel-sheet__grab-handle" />
        </div>
        <header className="studio-panel-sheet__header">
          <h2 id="studio-panel-sheet-title">{title}</h2>
          <button ref={closeRef} type="button" onClick={onCloseRef.current} className="studio-panel-sheet__close">
            Close
          </button>
        </header>
        <div className="studio-panel-sheet__content">{children}</div>
      </section>
    </div>
  );
}
