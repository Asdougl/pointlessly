import { RawRenderable } from "./elements";
import { $signal } from "./signal";

type Tools = {
  $signal: typeof $signal;
  $mount: (effect: () => (() => void) | void) => void;
};

type SignalReturn<T> = ReturnType<typeof $signal<T>>;

export const $ = <Props extends Record<string, unknown> | void>(
  renderer: (props: Props, tools: Tools) => RawRenderable
) => {
  let hasRendered = false;

  let signalIndex = 0;
  const signals: SignalReturn<unknown>[] = [];

  const unmounts = new Set<() => void>();

  const tools: Tools = {
    $signal: <T>(initialValue: T) => {
      if (signals[signalIndex]) {
        const signal = signals[signalIndex];
        signalIndex++;
        return signal as SignalReturn<T>;
      } else {
        const signal = $signal(initialValue);
        // @ts-ignore
        signals[signalIndex] = signal;
        signalIndex++;
        return signal as SignalReturn<T>;
      }
    },
    $mount: (effect: () => (() => void) | void) => {
      if (!hasRendered) {
        const unmount = effect();
        if (unmount) {
          unmounts.add(unmount);
        }
      }
    },
  };

  return (props: Props) => ({
    render: () => {
      const result = renderer(props, tools);
      hasRendered = true;
      return result;
    },
    destroy: () => {
      unmounts.forEach((unmount) => unmount());
    },
  });
};
®