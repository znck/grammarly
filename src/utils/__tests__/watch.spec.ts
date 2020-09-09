import { ref } from '@vue/reactivity';
import { watch, watchEffect } from '@/utils/watch';

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('watch', () => {
  it('should call callback when value is changed', async () => {
    const fn = jest.fn();
    const state = ref(0);
    const dispose = watch(state, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(0, undefined);

    state.value = 1;
    await nextTick();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(1, 0);

    state.value = 2;
    await nextTick();
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenLastCalledWith(2, 1);

    dispose();
  });

  it('should call callback when map is modified', async () => {
    const fn = jest.fn();
    const value = new Map<number, number>();
    const state = ref(value);
    const dispose = watch(state, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(value, undefined);

    state.value.set(1, 1);
    await nextTick();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(value, value);

    state.value.set(1, 2);
    await nextTick();
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenLastCalledWith(value, value);

    dispose();
  });
});

describe('watchEffect', () => {
  it('should call callback when value is changed', async () => {
    const state = ref(0);
    const fn = jest.fn(() => state.value);
    const dispose = watchEffect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    state.value = 1;
    await nextTick();
    expect(fn).toHaveBeenCalledTimes(2);

    state.value = 2;
    await nextTick();
    expect(fn).toHaveBeenCalledTimes(3);

    dispose();
  });
});
