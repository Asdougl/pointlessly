type HTMLElementTagName = keyof HTMLElementTagNameMap;

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type ExtendedEvent<TagName extends HTMLElementTagName> = Event & {
  currentTarget: HTMLElementTagNameMap[TagName];
};

type ExtendedEventHandlerMap<TagName extends HTMLElementTagName> = {
  onClick: (event: ExtendedEvent<TagName>) => void;
  onSubmit: (event: ExtendedEvent<TagName>) => void;
  onChange: (event: ExtendedEvent<TagName>) => void;
  onInput: (event: ExtendedEvent<TagName>) => void;
};

const EVENT_HANDLER_EVENT_MAP: Record<
  keyof ExtendedEventHandlerMap<"div">,
  string
> = {
  onClick: "click",
  onSubmit: "submit",
  onChange: "change",
  onInput: "input",
};

const isExtendedEventHandler = <T extends HTMLElementTagName>(
  prop: string
): prop is keyof ExtendedEventHandlerMap<T> => {
  return prop in EVENT_HANDLER_EVENT_MAP;
};

type Renderable = {
  render: () => Element;
  element: Element;
  replace: (newElement: Renderable) => void;
};

const renderToElement = (element: Renderable | string): Node => {
  if (typeof element === "string") {
    return document.createTextNode(element);
  } else {
    return element.render();
  }
};

type RenderableAttributes<TagName extends HTMLElementTagName> = Omit<
  HTMLElementTagNameMap[TagName],
  "click" | "submit" | "input"
> &
  ExtendedEventHandlerMap<TagName>;

const elementCreator = <
  TagName extends HTMLElementTagName,
  Attributes extends Partial<RenderableAttributes<TagName>>
>(
  tag: TagName
) => {
  return (props: Attributes) =>
    (
      ...children: (Renderable | Renderable[] | string | undefined | null)[]
    ) => {
      const el = document.createElement(tag);

      return {
        element: el,
        render: () => {
          for (const prop in props) {
            if (isExtendedEventHandler(prop)) {
              const propValue = props[prop];
              if (propValue) {
                el.addEventListener(EVENT_HANDLER_EVENT_MAP[prop], (e) => {
                  propValue({
                    ...e,
                    currentTarget: el,
                  });
                });
              }
            } else if (prop === "style" && props.style) {
              let styleString = "";
              Object.entries(props.style).forEach(([key, value]) => {
                styleString += `${key}: ${value};`;
              });
              el.style.cssText = styleString;
            } else if (prop in el) {
              (el as any)[prop] = (props as any)[prop];
            }
          }

          children.forEach((child) => {
            if (child) {
              if (Array.isArray(child)) {
                child.forEach((child) => {
                  el.appendChild(renderToElement(child));
                });
              } else {
                el.appendChild(renderToElement(child));
              }
            }
          });

          return el;
        },
        replace: (newElement: Renderable) => {
          el.replaceWith(newElement.render());
        },
      };
    };
};

export const div = elementCreator("div");
export const button = elementCreator("button");
export const a = elementCreator("a");
export const p = elementCreator("p");
export const h1 = elementCreator("h1");
export const h2 = elementCreator("h2");
export const h3 = elementCreator("h3");
export const h4 = elementCreator("h4");
export const h5 = elementCreator("h5");
export const h6 = elementCreator("h6");
export const span = elementCreator("span");
export const img = elementCreator("img");
export const input = elementCreator("input");
export const textarea = elementCreator("textarea");
export const label = elementCreator("label");
export const select = elementCreator("select");
export const option = elementCreator("option");
export const form = elementCreator("form");
export const ul = elementCreator("ul");
export const li = elementCreator("li");
export const table = elementCreator("table");
export const thead = elementCreator("thead");
export const tbody = elementCreator("tbody");
export const tr = elementCreator("tr");
export const th = elementCreator("th");
export const td = elementCreator("td");
export const strong = elementCreator("strong");
export const em = elementCreator("em");
export const pre = elementCreator("pre");
export const code = elementCreator("code");
export const br = elementCreator("br");
export const hr = elementCreator("hr");
export const iframe = elementCreator("iframe");

export const frag = (...children: Renderable[]) => {
  let currentFragment = document.createDocumentFragment();

  return {
    render: () => {
      const fragment = document.createDocumentFragment();
      children.forEach((child) => {
        fragment.appendChild(child.render());
      });
      currentFragment = fragment;
      return fragment;
    },
    element: currentFragment,
  };
};

// signals

type Listener<T> = () => T;

let currentListener: Listener<unknown> | undefined = undefined;

export const createSignal = <T>(initialValue: T) => {
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
};

export const createEffect = <T>(callback: Listener<T>) => {
  currentListener = callback;
  const result = callback();
  currentListener = undefined;
  return result;
};

export const $effect = <T>(callback: Listener<T>) => {
  return createEffect(callback);
};

export const $signal = <T>(initialValue: T) => {
  const { read, write } = createSignal(initialValue);
  return [read, write] as const;
};

export const $bind = (callback: Listener<Renderable>) => {
  let oldRenderable: Renderable | null = null;
  currentListener = () => {
    const newElement = callback();
    if (oldRenderable) {
      oldRenderable.replace(newElement);
      console.log("replacewith", oldRenderable.element, newElement.element);
    }
    oldRenderable = newElement;
  };
  const result = callback();
  currentListener = undefined;
  oldRenderable = result;
  return result;
};

export const $if = (
  condition: () => boolean,
  whenTrue: Renderable,
  whenFalse?: Renderable
): Renderable => {
  const placeholderElement = document.createElement("div");
  placeholderElement.style.display = "none";
  placeholderElement.dataset.bindworkIf = "true";

  const placeholderRenderable = {
    render: () =>
      condition()
        ? whenTrue.render()
        : whenFalse?.render() ?? placeholderElement,
    element: placeholderElement,
    replace: (newElement: Renderable) => {
      placeholderElement.replaceWith(newElement.render());
    },
  };

  let renderable: Renderable = condition()
    ? whenTrue
    : whenFalse ?? placeholderRenderable;

  const listener = () => {
    if (condition()) {
      renderable.replace(whenTrue);
      renderable = whenTrue;
    } else if (whenFalse) {
      renderable.replace(whenFalse);
      renderable = whenFalse;
    } else {
      renderable.replace(placeholderRenderable);
      renderable = placeholderRenderable;
    }
  };

  createEffect(listener);

  console.log(renderable);

  return renderable;
};

export const $for = <T>(
  items: () => T[],
  wrapper: (
    ...children: (Renderable | Renderable[] | string | undefined | null)[]
  ) => Renderable,
  build: (item: T) => Renderable
): Renderable => {
  let renderableList: Renderable[] = [];
  let wrapperRenderable: Renderable | null = null;
  currentListener = () => {
    console.log("got new data");
    renderableList.forEach((item) => {
      item.element.remove();
    });
    renderableList = items().map(build);
    const newWrappableRenderable = wrapper(...renderableList);
    if (wrapperRenderable) {
      console.log("replacing", wrapperRenderable.element);
      wrapperRenderable.element.replaceWith(newWrappableRenderable.render());
      console.log("replacement", newWrappableRenderable.element);
      wrapperRenderable = newWrappableRenderable;
    }
  };
  const result = items().map(build);
  wrapperRenderable = wrapper(...result);
  currentListener = undefined;
  renderableList = result;
  return wrapperRenderable;
};

// custom components

type Operators = {
  $signal: typeof $signal;
  $mount: (effect: () => (() => void) | void) => void;
};

type SignalReturn<T> = ReturnType<typeof $signal<T>>;

export const $ = <Props extends Record<string, unknown> | void>(
  renderer: (props: Props, tools: Operators) => Renderable
): ((props: Props) => Renderable) => {
  let hasRendered = false;

  let signalIndex = 0;
  const signals: SignalReturn<unknown>[] = [];

  const unmounts = new Set<() => void>();

  const tools: Operators = {
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

  return (props: Props) => {
    const component = renderer(props, tools);

    return {
      render: () => {
        const result = component.render();
        hasRendered = true;
        return result;
      },
      element: component.element,
      replace: (newComponent: Renderable) => {
        unmounts.forEach((unmount) => unmount());
        unmounts.clear();
        component.replace(newComponent);
      },
    };
  };
};
