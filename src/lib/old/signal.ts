type Listener<T> = () => T;

let currentListener: Listener<unknown> | undefined = undefined;

export function createSignal<T>(initialValue: T) {
  let value = initialValue;

  const subscribers = new Set<Listener<unknown>>();

  const read = () => {
    if (currentListener !== undefined) {
      subscribers.add(currentListener);
    }
    return value;
  };
  const write = (newValue: T) => {
    value = newValue;
    subscribers.forEach((fn) => fn());
  };

  return { read, write } as const;
}

export function $signal<T>(initialValue: T) {
  const { read, write } = createSignal(initialValue);
  return [read, write] as const;
}

export function $effect<T>(callback: Listener<T>) {
  currentListener = callback;
  const result = callback();
  currentListener = undefined;
  return result;
}

export function $react(callback: Listener<Element>) {
  let oldElement: Element | null = null;
  currentListener = () => {
    const newElement = callback();
    if (oldElement) {
      console.log("replacewith", oldElement, newElement);
      oldElement.replaceWith(newElement);
    }
    oldElement = newElement;
  };
  const result = callback();
  currentListener = undefined;
  oldElement = result;
  console.log("woah, nice element", result);
  return result;
}

export function $connect<Props extends Record<string, unknown>>(
  renderable: (props: Props) => Element
) {
  return (props: Props) => {
    return $react(() => renderable(props));
  };
}
