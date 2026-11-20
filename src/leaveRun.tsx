// Going back while a long run is active (Learn my car, health check, Find my
// car's sensors, Unknown values, the MOT read) asks first, then stops the run,
// waits for it to save what it found and goes back.
//
// Only the back button and the back swipe ask. Switching to another app or
// locking the phone asks nothing and stops nothing: the run carries on in the
// background (src/background.ts).
import { usePreventRemove } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ConfirmSheet } from './ui';

export const LEAVE_RUN_TITLE = 'Stop the run and keep what was found?';
export const LEAVE_RUN_LINE = 'What was found so far is saved. Keep running lets it carry on.';
// A run that does not end this soon after Stop is left anyway.
export const LEAVE_WAIT_MS = 8000;

export function LeaveRunGuard({ active, onStop }: { active: boolean; onStop: () => void }) {
  const [asking, setAsking] = useState(false);
  // The blocked back action, carried out once the run has ended.
  const goBack = useRef<(() => void) | null>(null);
  const leaving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePreventRemove(active, ({ repeat }) => {
    goBack.current = repeat;
    // Back pressed again while the run is stopping: the first answer stands.
    if (!leaving.current) setAsking(true);
  });

  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    leaving.current = false;
    const go = goBack.current;
    goBack.current = null;
    go?.();
  };

  // The run ended after "Stop and go back": the screen has saved, so leave.
  useEffect(() => {
    // The run ended under the open question: nothing is left to stop, so close it.
    if (!active && !leaving.current) {
      setAsking(false);
      goBack.current = null;
    }
    if (active || !leaving.current) return undefined;
    const id = setTimeout(leave, 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ConfirmSheet
      visible={asking}
      title={LEAVE_RUN_TITLE}
      lines={[LEAVE_RUN_LINE]}
      confirmLabel="Stop and go back"
      cancelLabel="Keep running"
      onConfirm={() => {
        setAsking(false);
        // Already ended (the run finished while the sheet was open): go at once.
        if (!active) {
          leave();
          return;
        }
        leaving.current = true;
        onStop();
        timer.current = setTimeout(leave, LEAVE_WAIT_MS);
      }}
      onCancel={() => {
        setAsking(false);
        goBack.current = null;
      }}
    />
  );
}
