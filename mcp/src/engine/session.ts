// ============================================================================
// did-mcp — Session State Manager
// ============================================================================
// Immutable handle store. Each tool call that creates an object registers a
// handle; later tool calls reference it by ID (e.g. "panel_1", "estimate_1").

import {
  type SessionState,
  type ObjectHandle,
  type HandleType,
  type RuntimeType,
  type RpcObjectCreated,
  createSessionState,
  getPersistenceClass,
  createStore,
  type Store,
} from "../types.js";

export type SessionStore = Store<SessionState>;

export function createSessionStore(sessionId: string): SessionStore {
  return createStore(createSessionState(sessionId));
}

export function registerHandle(
  store: SessionStore,
  created: RpcObjectCreated,
  workerId: string,
  createdBy: string,
  runtime: RuntimeType = "r",
): ObjectHandle {
  const state = store.getState();
  const persistenceClass = getPersistenceClass(created.rClass);

  const handle: ObjectHandle = {
    id: created.id,
    type: created.type as HandleType,
    runtime,
    rClass: created.rClass,
    persistenceClass,
    sessionId: state.sessionId,
    workerId,
    createdBy,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    sizeBytes: created.sizeBytes,
    summary: created.summary,
    schema: created.schema,
  };

  store.setState((prev) => ({
    ...prev,
    handles: new Map([...prev.handles, [handle.id, handle]]),
  }));

  return handle;
}

export function getHandle(
  store: SessionStore,
  id: string,
): ObjectHandle | undefined {
  return store.getState().handles.get(id);
}

export function dropHandle(store: SessionStore, id: string): boolean {
  const state = store.getState();
  if (!state.handles.has(id)) return false;
  store.setState((prev) => {
    const next = new Map(prev.handles);
    next.delete(id);
    return { ...prev, handles: next };
  });
  return true;
}

export function listHandles(store: SessionStore): ObjectHandle[] {
  return [...store.getState().handles.values()];
}

export function updateHandlesWorkerId(
  store: SessionStore,
  newWorkerId: string,
): void {
  store.setState((prev) => {
    const newHandles = new Map<string, ObjectHandle>();
    for (const [id, h] of prev.handles) {
      newHandles.set(id, { ...h, workerId: newWorkerId });
    }
    return { ...prev, handles: newHandles };
  });
}

export function getSerializableHandleIds(store: SessionStore): string[] {
  const handles = store.getState().handles;
  return [...handles.values()]
    .filter((h) => h.persistenceClass === "serializable")
    .map((h) => h.id);
}

export function markHandlesLost(
  store: SessionStore,
  lostIds: string[],
): void {
  const lostSet = new Set(lostIds);
  store.setState((prev) => {
    const newHandles = new Map(prev.handles);
    for (const id of lostSet) {
      newHandles.delete(id);
    }
    return { ...prev, handles: newHandles };
  });
}
