/**
 * A per-tool reducer for the shared tool lifecycle.
 *
 * Every tool moves through the same five states, so the transitions live here
 * rather than being re-implemented five times:
 *
 *   EMPTY -> IMAGE_SELECTED -> PROCESSING -> COMPLETED
 *                                   \-> ERROR
 *
 * The reducer also enforces the guard the spec asks for: `download` is only
 * reachable from COMPLETED, so the button cannot exist before there is output.
 */

import { useCallback, useReducer } from 'react';
import { AppError } from '../lib/errors';
import type { OutputMeta, ProcessResult } from '../lib/types';

export type ToolPhase = 'empty' | 'selected' | 'processing' | 'completed' | 'error';

export interface ToolState {
  phase: ToolPhase;
  output: OutputMeta | null;
  blob: Blob | null;
  durationMs: number | null;
  error: AppError | null;
  /** Bumped on each successful run so previews re-mount cleanly. */
  runId: number;
}

const INITIAL: ToolState = {
  phase: 'empty',
  output: null,
  blob: null,
  durationMs: null,
  error: null,
  runId: 0,
};

type Action =
  | { type: 'image-selected' }
  | { type: 'reset' }
  | { type: 'processing' }
  | { type: 'completed'; result: ProcessResult }
  | { type: 'failed'; error: AppError };

function reducer(state: ToolState, action: Action): ToolState {
  switch (action.type) {
    case 'image-selected':
      return { ...INITIAL, phase: 'selected', runId: state.runId };

    case 'reset':
      return { ...INITIAL, runId: state.runId + 1 };

    case 'processing':
      return { ...state, phase: 'processing', error: null };

    case 'completed':
      return {
        phase: 'completed',
        output: action.result.meta,
        blob: action.result.blob,
        durationMs: action.result.durationMs,
        error: null,
        runId: state.runId + 1,
      };

    case 'failed':
      return { ...state, phase: 'error', error: action.error, output: null, blob: null };

    default:
      return state;
  }
}

export interface ToolController {
  state: ToolState;
  /** Call after a new image is loaded. */
  markSelected: () => void;
  /** Call when the input changes so stale output is discarded. */
  invalidate: () => void;
  /** Wrap an async operation; handles PROCESSING/COMPLETED/ERROR for you. */
  run: (operation: () => Promise<ProcessResult>) => Promise<ProcessResult | null>;
  reset: () => void;
}

export function useToolController(): ToolController {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const markSelected = useCallback(() => dispatch({ type: 'image-selected' }), []);
  const invalidate = useCallback(() => dispatch({ type: 'reset' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const run = useCallback(async (operation: () => Promise<ProcessResult>) => {
    dispatch({ type: 'processing' });
    try {
      const result = await operation();
      dispatch({ type: 'completed', result });
      return result;
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError({
              code: 'unknown',
              title: 'Something went wrong',
              message: 'SnapForge could not finish processing this image.',
              hint: 'Try again, or choose a different image.',
            });
      dispatch({ type: 'failed', error: appError });
      return null;
    }
  }, []);

  return { state, markSelected, invalidate, run, reset };
}

export const PHASE_LABEL: Record<ToolPhase, string> = {
  empty: 'Waiting for an image',
  selected: 'Ready to process',
  processing: 'Processing',
  completed: 'Completed',
  error: 'Error',
};
