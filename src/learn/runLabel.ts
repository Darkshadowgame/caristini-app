// How the Car tab names the last Learn my car run. Pure.
import type { Vehicle } from '../vehicle/garage';

export type LearnRunLabel = 'First read done' | 'First read stopped early' | 'Last run';

// A first (full) read counts as done only once it ran to the end, which is
// when learnFullAt is set (src/learn/runLearn.ts). A run that stopped in step
// 1 must not read as done.
export function learnRunLabel(v: Pick<Vehicle, 'learnRun' | 'learnFullAt' | 'learnTimes'>): LearnRunLabel {
  const run = v.learnRun;
  if (!run) return 'Last run';
  if (run.full && !v.learnFullAt) return 'First read stopped early';
  if (run.full && !v.learnTimes?.repeat) return 'First read done';
  return 'Last run';
}

// The end of the Car tab's line: what running it again does.
export function learnAgainVerb(label: LearnRunLabel): 'finish' | 'refresh' {
  return label === 'First read stopped early' ? 'finish' : 'refresh';
}
