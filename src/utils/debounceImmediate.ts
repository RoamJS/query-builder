export const debounceImmediate = <T extends unknown[]>(
  callback: (...args: T) => void,
  wait: number
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let calledImmediately = false;

  return (...args: T) => {
    if (!calledImmediately) {
      callback(...args);
      calledImmediately = true;
    }

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      calledImmediately = false;
    }, wait);
  };
};
