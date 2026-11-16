'use client';
import { useEffect, useRef } from 'react';

/* Range input that keeps the two native events apart:
   onInput fires while dragging, onCommit on the native `change` (release). */
export default function Range({ onInput, onCommit, value, ...rest }) {
  const ref = useRef(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;

  useEffect(() => {
    const el = ref.current;
    const fn = e => commit.current && commit.current(e);
    el.addEventListener('change', fn);
    return () => el.removeEventListener('change', fn);
  }, []);

  return <input ref={ref} type="range" value={value} onChange={e => onInput(+e.target.value, e)} {...rest} />;
}
