import type { Track, Workspace } from "./model";

/** Capture once per input, retaining originals across edits, reloads and undo. */
export function rememberInputStarts(workspace: Workspace) {
  const ids = new Set(workspace.tracks.map((track) => track.id));
  const originals = (workspace.inputOriginals ?? []).filter((track) =>
    ids.has(track.id),
  );
  const known = new Set(originals.map((track) => track.id));
  for (const track of workspace.tracks) {
    if (!known.has(track.id)) originals.push(structuredClone(track));
  }
  workspace.inputOriginals = originals;
}

export function inputStart(
  workspace: Workspace,
  id: string,
): Track | undefined {
  return workspace.inputOriginals?.find((track) => track.id === id);
}

export function resetInputTrack(workspace: Workspace, id: string): Track {
  const original = inputStart(workspace, id);
  if (!original || !workspace.tracks.some((track) => track.id === id))
    throw new Error(
      "There is no saved starting version for this input. Reopen its GPX file to start again.",
    );
  return structuredClone(original);
}
