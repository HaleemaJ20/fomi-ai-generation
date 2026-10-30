'use client';

import { useEffect, useRef } from 'react';

let activeLocks = 0;
let previousBodyStyles = null;

export default function useModalScrollLock(active) {
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    if (activeLocks === 0) {
      const { body, documentElement } = document;
      previousBodyStyles = {
        bodyOverflow: body.style.overflow,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyWidth: body.style.width,
        bodyPaddingRight: body.style.paddingRight,
        scrollY: window.scrollY,
        scrollbarWidth: window.innerWidth - documentElement.clientWidth,
      };
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${previousBodyStyles.scrollY}px`;
      body.style.width = '100%';
      if (previousBodyStyles.scrollbarWidth > 0) {
        body.style.paddingRight = `${previousBodyStyles.scrollbarWidth}px`;
      }
    }
    activeLocks += 1;

    return () => {
      activeLocks -= 1;
      if (activeLocks === 0 && previousBodyStyles) {
        const { body } = document;
        body.style.overflow = previousBodyStyles.bodyOverflow;
        body.style.position = previousBodyStyles.bodyPosition;
        body.style.top = previousBodyStyles.bodyTop;
        body.style.width = previousBodyStyles.bodyWidth;
        body.style.paddingRight = previousBodyStyles.bodyPaddingRight;
        window.scrollTo(0, previousBodyStyles.scrollY);
        previousBodyStyles = null;
      }
    };
  }, [active]);

  useEffect(() => {
    if (active) triggerRef.current = document.activeElement;
    else if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
  }, [active]);

  return triggerRef;
}
