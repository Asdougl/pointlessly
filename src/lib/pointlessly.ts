import { isSameDependencies, isSameProps } from "../util/general";
import {
  hasOwnPropertyType,
  isFunction,
  isObject,
  isString,
} from "../util/guards";

type BaseComponent = {
  id: string;
  render: () => HTMLElement | Text;
  destroy: () => void;
  replace: (newComponent: Component) => void;
  append: (newComponent: Component) => void;
};

type ForComponent = Omit<BaseComponent, "render"> & {
  render: () => DocumentFragment;
};

type IntrinsicComponent = BaseComponent & {
  tag: keyof HTMLElementTagNameMap;
};

const createId = () => Math.random().toString(36).substring(2);

type CustomComponent<Props extends Record<string, unknown> | void | unknown> =
  BaseComponent & {
    reload: (newProps: Props) => void;
    props: Props;
    serial: string;
    element: () => HTMLElement | Text | null;
  };

type Component = BaseComponent | CustomComponent<void> | IntrinsicComponent;

const isComponent = (value: unknown): value is Component => {
  return (
    isObject(value) &&
    hasOwnPropertyType(value, "id", isString) &&
    hasOwnPropertyType(value, "render", isFunction) &&
    hasOwnPropertyType(value, "destroy", isFunction)
  );
};

const isCustomComponent = (
  value: Component
): value is CustomComponent<unknown> => {
  return isObject(value) && hasOwnPropertyType(value, "props", isObject);
};

type Listener<T> = () => T;

type SignalValue<T> = () => T;

type Signal<T> = {
  read: SignalValue<T>;
  write: (newValue: T | ((curr: T) => T)) => void;
  subscribe: (listener: Listener<T>) => () => void;
  unsubscribe: (listener: Listener<T>) => void;
};

type SignalContext = {
  currentListener: Listener<unknown> | undefined;
  unsubscribers: Signal<unknown>["unsubscribe"][];
};

type RenderSignal<T> = Readonly<
  [
    read: Signal<T>["read"],
    write: Signal<T>["write"],
    util: {
      subscribe: Signal<T>["subscribe"];
      unsubscribe: Signal<T>["unsubscribe"];
    }
  ]
>;

const createRenderSignal = <T>(signal: Signal<T>): RenderSignal<T> => {
  return [
    signal.read,
    signal.write,
    {
      subscribe: signal.subscribe,
      unsubscribe: signal.unsubscribe,
    },
  ];
};

const signalFactory =
  (context: SignalContext) =>
  <T>(initialValue: T): Signal<T> => {
    let value = initialValue;

    const listeners = new Set<(newValue: T) => void>();

    const subscribe: Signal<T>["subscribe"] = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    const unsubscribe: Signal<T>["unsubscribe"] = (listener) => {
      listeners.delete(listener);
    };

    const read: Signal<T>["read"] = () => {
      if (context.currentListener !== undefined) {
        const listener = context.currentListener;
        listeners.add(listener);
        context.unsubscribers.push(() => listeners.delete(listener));
      }
      return value;
    };

    const write: Signal<T>["write"] = (newValue) => {
      value = isFunction(newValue) ? newValue(value) : newValue;
      listeners.forEach((listener) => listener(value));
    };

    return {
      read,
      write,
      subscribe,
      unsubscribe,
    };
  };

type Tools = {
  $signal: <T>(initialValue: T) => RenderSignal<T>;
  $mount: (effect: () => (() => void) | void) => void;
  $effect: (effect: () => (() => void) | void, dependencies: unknown[]) => void;
  $bind: (effect: () => Component) => Component;
  $if: (
    condition: () => boolean
  ) => (whenTrue: Component, whenFalse?: Component) => Component;
  $for: <T>(
    items: Signal<T[]>["read"],
    renderItem: (item: T) => Component
  ) => ForComponent;
  $id: () => string;
};

const createEmptyComponent = (): Component => {
  const element = document.createTextNode("");
  const id = createId();

  return {
    id,
    render: () => element,
    destroy: () => {
      element.remove();
    },
    replace: (newComponent) => {
      element.replaceWith(newComponent.render());
    },
    append: (newComponent) => {
      element.appendChild(newComponent.render());
    },
  };
};

type EffectTracker = {
  effect: () => (() => void) | void;
  dependencies: unknown[];
  unmount: (() => void) | void;
};

export const $ = <Props extends Record<string, unknown> | void = void>(
  renderer: (props: Props, tools: Tools) => Component
): ((props: Props) => CustomComponent<Props>) => {
  const serial = createId();
  return (props: Props) => {
    let hasRendered = false;

    const id = createId();

    // Signals
    let signalIndex = 0;
    const signals: Signal<unknown>[] = [];

    // Unmounts
    const unmounts = new Set<() => void>();

    // Effects
    let effectIndex = 0;
    const effects: EffectTracker[] = [];

    // Props management
    const propStore: { prev: Props; curr: Props } = {
      prev: props,
      curr: props,
    };

    const updateProps = (nextProps: Props) => {
      propStore.prev = propStore.curr;
      propStore.curr = nextProps;
    };

    const hasSameProps = () =>
      propStore.prev &&
      propStore.curr &&
      isSameProps(propStore.prev, propStore.curr);

    // Signal Context
    const signalCtx: SignalContext = {
      currentListener: undefined,
      unsubscribers: [],
    };

    const createSignal = signalFactory(signalCtx);

    const tools: Tools = {
      $signal: <T>(initialValue: T) => {
        // TODO:should add something here if a signal changes, check any dependent effects
        if (signals[signalIndex]) {
          const signal = signals[signalIndex] as Signal<T>;
          signalIndex++;
          return createRenderSignal(signal);
        } else {
          const signal = createSignal(initialValue);
          // @ts-ignore
          signals[signalIndex] = signal as Signal<T>;
          signalIndex++;
          return createRenderSignal(signal);
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
      $effect: (effect: () => (() => void) | void, dependencies: unknown[]) => {
        console.warn("EXPERIMENTAL");
        if (effects[effectIndex]) {
          // Effect already exists!
          const oldEffect = effects[effectIndex];

          if (!isSameDependencies(oldEffect.dependencies, dependencies)) {
            // Dependencies have changed, we should run the effect again
            if (oldEffect.unmount) {
              oldEffect.unmount();
            }
            const unmount = oldEffect.effect();
            if (unmount) {
              unmounts.add(unmount);
              oldEffect.unmount = unmount;
            }
          }
          effectIndex++;
        } else {
          // Effect does not exist, we should run it
          const unmount = effect();
          let unmountFn: (() => void) | void = undefined;

          if (unmount) {
            unmounts.add(unmount);
            unmountFn = () => {
              unmounts.delete(unmount);
              unmount();
            };
          }
          effects[effectIndex] = {
            effect,
            dependencies,
            unmount: unmountFn,
          };
          effectIndex++;
        }
      },
      $bind: (renderFn: () => Component): Component => {
        let component: Component | null = null;
        const rerender = () => {
          if (component) {
            component.render();
          } else {
            component = renderFn();
          }
          return component;
        };
        signalCtx.currentListener = rerender;
        component = renderFn();
        let initialRender: HTMLElement | Text | null = component.render(); // forces any signals to phone home
        const unsubscribers = [...signalCtx.unsubscribers];
        signalCtx.unsubscribers = [];
        signalCtx.currentListener = undefined;

        return {
          id: createId(),
          render: () => {
            if (component) {
              if (initialRender) {
                const initialRenderCopy = initialRender;
                initialRender = null;
                return initialRenderCopy;
              }
              return component.render();
            } else {
              component = rerender();
              return component.render();
            }
          },
          destroy: () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe(rerender));
            if (component) {
              component.destroy();
            }
          },
          replace: (newComponent) => {
            if (component) {
              component.replace(newComponent);
            }
          },
          append: (newComponent) => {
            if (component) {
              component.append(newComponent);
            }
          },
        };
      },
      $if: (condition) => (whenTrue, whenFalse) => {
        let component: Component | null = null;
        const rerender = () => {
          const renderResult = condition()
            ? whenTrue
            : whenFalse ?? createEmptyComponent();
          if (component && component !== renderResult) {
            component.replace(renderResult);
            component.destroy();
            component = renderResult;
          }
          return renderResult;
        };
        signalCtx.currentListener = rerender;
        component = rerender();
        const unsubscribers = [...signalCtx.unsubscribers];
        signalCtx.unsubscribers = [];
        signalCtx.currentListener = undefined;

        return {
          id: createId(),
          render: () => {
            if (component) {
              return component.render();
            } else {
              component = rerender();
              return component.render();
            }
          },
          destroy: () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe(rerender));
            if (component) {
              component.destroy();
            }
          },
          replace: (newComponent) => {
            if (component) {
              component.replace(newComponent);
            }
          },
          append: (newComponent) => {
            if (component) {
              component.append(newComponent);
            }
          },
        };
      },
      $for: (items, renderItem) => {
        let components: Component[] = [];
        const rerender = () => {
          const newComponents = items().map((item) => renderItem(item));
          if (components.length > 0) {
            // some items already rendered!
            // we should replace what we can and destroy the rest
            const newComponentsLength = newComponents.length;
            const oldComponentsLength = components.length;
            const newComponentsList = [];
            const length = Math.max(newComponentsLength, oldComponentsLength);
            for (let i = 0; i < length; i++) {
              if (i < newComponentsLength && i < oldComponentsLength) {
                const prev = components[i],
                  next = newComponents[i];
                if (
                  isCustomComponent(prev) &&
                  isCustomComponent(next) &&
                  prev.serial === next.serial
                ) {
                  prev.reload(next.props);
                  newComponentsList.push(prev);
                } else {
                  components[i].replace(newComponents[i]);
                  newComponentsList.push(newComponents[i]);
                }
              } else if (i < newComponentsLength) {
                console.log(newComponentsList);
                newComponentsList[newComponentsList.length - 1].append(
                  newComponents[i]
                );
                newComponentsList.push(newComponents[i]);
              } else {
                components[i].destroy();
              }
            }
            components = newComponentsList;
          } else {
            // no existing components
            components = newComponents;
          }
          if (components.length === 0) components = [createEmptyComponent()];
          return components;
        };
        signalCtx.currentListener = rerender;
        components = rerender();
        if (components.length === 0) components = [createEmptyComponent()];
        const unsubscribers = [...signalCtx.unsubscribers];
        signalCtx.unsubscribers = [];
        signalCtx.currentListener = undefined;

        return {
          id: createId(),
          render: () => {
            const frag = document.createDocumentFragment();
            if (!components.length) {
              components = [createEmptyComponent()];
            }
            components.forEach((component) => {
              frag.appendChild(component.render());
            });
            return frag;
          },
          destroy: () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe(rerender));
            if (components.length > 0) {
              components.forEach((component) => component.destroy());
            }
          },
          replace: (newComponent) => {
            if (components.length > 0) {
              const firstComponent = components[0];
              if (firstComponent) {
                firstComponent.replace(newComponent);
              }
              components.forEach((component) => component.destroy());
            }
            // handle if no components
          },
          append: (newComponent) => {
            if (components.length > 0) {
              const lastComponent = components[components.length - 1];
              if (lastComponent) {
                lastComponent.append(newComponent);
              }
            }
            // handle if no components
          },
        };
      },
      $id: () => id,
    };

    let lastRenderResult: ReturnType<Component["render"]> | null = null;

    const render = () => {
      signalIndex = 0;
      const result = renderer(propStore.curr, tools);
      hasRendered = true;
      lastRenderResult = result.render();
      return lastRenderResult;
    };

    const onDestroy = () => {
      lastRenderResult?.remove();
      unmounts.forEach((unmount) => unmount());
    };

    return {
      id,
      props,
      serial,
      element: () => lastRenderResult,
      render,
      reload: (newProps) => {
        signalIndex = 0;
        updateProps(newProps);
        if (lastRenderResult && !hasSameProps()) {
          lastRenderResult.replaceWith(render());
        }
      },
      destroy: onDestroy,
      replace: (newComponent) => {
        const replaceWith = newComponent.render();
        if (lastRenderResult) {
          lastRenderResult.replaceWith(replaceWith);
        }
        onDestroy();
      },
      append: (newComponent) => {
        console.log("hi :)", lastRenderResult, id);
        const appendWith = newComponent.render();
        if (lastRenderResult?.parentElement) {
          console.log("ho");
          lastRenderResult.parentElement.appendChild(appendWith);
        }
      },
    };
  };
};

type BasicComponentAttributes = {
  id?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  data?: Record<string, unknown>;
  onClick?: (event: Event) => void;
  onMouseEnter?: (event: Event) => void;
  onMouseLeave?: (event: Event) => void;
  onFocus?: (event: Event) => void;
  onBlur?: (event: Event) => void;
};

type AttributesMap = {
  div: BasicComponentAttributes;
  span: BasicComponentAttributes;
  p: BasicComponentAttributes;
  h1: BasicComponentAttributes;
  h2: BasicComponentAttributes;
  h3: BasicComponentAttributes;
  h4: BasicComponentAttributes;
  h5: BasicComponentAttributes;
  h6: BasicComponentAttributes;
  ol: BasicComponentAttributes;
  ul: BasicComponentAttributes;
  li: BasicComponentAttributes;
  main: BasicComponentAttributes;
  article: BasicComponentAttributes;
  aside: BasicComponentAttributes;
  nav: BasicComponentAttributes;
  header: BasicComponentAttributes;
  footer: BasicComponentAttributes;
  a: BasicComponentAttributes & {
    href?: string;
    target?: string;
  };
  img: BasicComponentAttributes & {
    src?: string;
    alt?: string;
  };
  button: BasicComponentAttributes & {
    onClick?: (event: Event) => void;
    disabled?: boolean;
  };
  input: BasicComponentAttributes & {
    type?: string;
    value?: string;
    placeholder?: string;
    onChange?: (event: Event) => void;
    disabled?: boolean;
    checked?: boolean;
  };
  form: BasicComponentAttributes & {
    onSubmit?: (event: Event) => void;
  };
  label: BasicComponentAttributes & {
    htmlFor?: string;
  };
};

type ElementChildren =
  | Component
  | Component[]
  | SignalValue<string | number | null | false | undefined>
  | ForComponent
  | string
  | number
  | boolean
  | null
  | undefined;

const elementFactory =
  <TagName extends keyof AttributesMap>(tag: TagName) =>
  (attributes: AttributesMap[TagName] | void) =>
  (...children: ElementChildren[]): IntrinsicComponent => {
    let el: HTMLElement | Text | null;

    const id = createId();

    const childrenArray = children.flat();

    return {
      id,
      tag,
      render: () => {
        const newEl = document.createElement(tag);

        if (attributes) {
          newEl.className = attributes?.className ?? "";

          if (attributes.style) {
            Object.entries(attributes.style).forEach(([key, value]) => {
              newEl.style.cssText += `${key}: ${value};`;
            });
          }

          if (attributes.id) {
            newEl.id = attributes.id;
          }

          if (attributes.onClick) {
            newEl.addEventListener("click", attributes.onClick);
          }

          if (attributes.onMouseEnter) {
            newEl.addEventListener("mouseenter", attributes.onMouseEnter);
          }

          if (attributes.onMouseLeave) {
            newEl.addEventListener("mouseleave", attributes.onMouseLeave);
          }

          if (attributes.onFocus) {
            newEl.addEventListener("focus", attributes.onFocus);
          }

          if (attributes.onBlur) {
            newEl.addEventListener("blur", attributes.onBlur);
          }

          if (attributes.data) {
            Object.entries(attributes.data).forEach(([key, value]) => {
              newEl.dataset[key] = value?.toString() ?? "";
            });
          }

          if ("href" in attributes) {
            newEl.setAttribute("href", attributes.href ?? "");
          }

          if ("target" in attributes) {
            newEl.setAttribute("target", attributes.target ?? "");
          }

          if ("src" in attributes) {
            newEl.setAttribute("src", attributes.src ?? "");
          }

          if ("alt" in attributes) {
            newEl.setAttribute("alt", attributes.alt ?? "");
          }

          if ("type" in attributes) {
            newEl.setAttribute("type", attributes.type ?? "");
          }

          if ("value" in attributes) {
            newEl.setAttribute("value", attributes.value ?? "");
          }

          if ("placeholder" in attributes) {
            newEl.setAttribute("placeholder", attributes.placeholder ?? "");
          }

          if ("onChange" in attributes && attributes.onChange) {
            newEl.addEventListener("change", attributes.onChange);
          }

          if ("disabled" in attributes) {
            newEl.setAttribute(
              "disabled",
              attributes.disabled?.toString() ?? ""
            );
          }

          if ("onSubmit" in attributes && attributes.onSubmit) {
            newEl.addEventListener("submit", attributes.onSubmit);
          }

          if ("htmlFor" in attributes) {
            newEl.setAttribute("for", attributes.htmlFor ?? "");
          }

          if ("checked" in attributes) {
            newEl.setAttribute("checked", attributes.checked?.toString() ?? "");
          }
        }

        childrenArray.forEach((child) => {
          if (isComponent(child)) {
            newEl.appendChild(child.render());
          } else if (isFunction(child)) {
            const result = child();
            newEl.appendChild(
              document.createTextNode(result?.toString() ?? "")
            );
          } else {
            newEl.appendChild(document.createTextNode(child?.toString() ?? ""));
          }
        });

        if (el) el.replaceWith(newEl);

        el = newEl;

        return newEl;
      },
      destroy: () => {
        if (el) {
          el.remove();
        }
      },
      replace: (newComponent) => {
        if (isComponent(newComponent)) {
          const result = newComponent.render();
          if (el) {
            el.replaceWith(result);
          }
        }
      },
      append: (newComponent) => {
        if (isComponent(newComponent)) {
          const result = newComponent.render();
          if (el && el.parentElement) {
            el.parentElement.appendChild(result);
          }
        }
      },
    };
  };

export const renderRoot = (element: HTMLElement, component: Component) => {
  element.appendChild(component.render());
};

// default components
export const div = elementFactory("div");
export const span = elementFactory("span");
export const p = elementFactory("p");
export const h1 = elementFactory("h1");
export const h2 = elementFactory("h2");
export const h3 = elementFactory("h3");
export const h4 = elementFactory("h4");
export const h5 = elementFactory("h5");
export const h6 = elementFactory("h6");
export const ul = elementFactory("ul");
export const li = elementFactory("li");
export const a = elementFactory("a");
export const img = elementFactory("img");
export const button = elementFactory("button");
export const input = elementFactory("input");

const Counter = $<{ title: string; initialValue?: number }>(
  ({ initialValue }, { $signal, $bind, $id }) => {
    const [count, setCount] = $signal(initialValue ?? 0);

    return div({ className: "flex items-start px-4" })(
      $bind(() => div({ className: "text-lg font-mono" })(count)),
      button({
        onClick: () => {
          setCount((curr) => curr + 1);
        },
        className: "px-2 font-bold bg-neutral-100 rounded-lg",
      })("+"),
      button({
        onClick: () => {
          setCount((curr) => curr - 1);
        },
        className: "px-2 font-bold bg-neutral-100 rounded-lg",
      })("-"),
      span()($id())
    );
  }
);

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const MyComponent = $((_, { $signal, $mount, $if, $for }) => {
  const [todos, setTodos] = $signal<Todo[]>([]);
  const [loading, setLoading] = $signal(true);

  $mount(() => {
    const fetchTodos = async () => {
      await wait(1000);
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/todos?_limit=10"
      );
      const json = await response.json();
      setTodos(json);
      setLoading(false);
    };

    fetchTodos();
  });

  return div()(
    div({ className: "flex flex-col items-start px-4" })(
      $if(loading)(
        div({ className: "text-lg font-mono" })("Loading..."),
        ul({ className: "flex flex-col px-4" })(
          $for(todos, (item) => {
            return Counter({ initialValue: 0, title: item.title });
          })
        )
      )
    )
  );
});
