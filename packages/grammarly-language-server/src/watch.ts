import { Ref, effect, stop, isRef } from '@vue/reactivity';

const INITIAL_WATCHER_VALUE = {};

export function watch<T>(ref: Ref<T>, cb: (newValue: T, oldValue: T | undefined) => void) {
  const getter = () => traverse(ref.value) as T;

  let oldValue: T = INITIAL_WATCHER_VALUE as any;
  const job = () => {
    const newValue = runner();
    try {
      cb(newValue, oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue);
    } catch (error) {
      console.error(error);
    }

    oldValue = newValue;
  };
  const runner = effect(getter, {
    lazy: true,
    scheduler: job,
  });

  job();

  return () => {
    stop(runner);
  };
}

export function watchEffect(cb: () => void) {
  const runner = effect(cb, { lazy: true });

  runner();

  return () => {
    stop(runner);
  };
}

function traverse(value: unknown, seen: Set<unknown> = new Set()) {
  if (!isObject(value) || seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (isRef(value)) {
    traverse(value.value, seen);
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else if (value instanceof Map) {
    value.forEach((_, key) => {
      // to register mutation dep for existing keys
      traverse(value.get(key), seen);
    });
  } else if (value instanceof Set) {
    value.forEach((v) => {
      traverse(v, seen);
    });
  } else {
    for (const key in value) {
      traverse((value as any)[key], seen);
    }
  }
  return value;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
