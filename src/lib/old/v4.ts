import { isObject } from "../../util/guards";

// Core Concepts
type Renderable = HTMLElement | Text | null;

type BaseComponent = {
  id: string;
  render: () => Renderable;
  element: () => Renderable;
};

type IntrinsicComponent = BaseComponent & {
  type: "intrinsic";
};

type Subscription = (id: string) => void;

type ReactiveComponent = BaseComponent & {
  type: "reactive";
  subscribe: (callback: Subscription) => void;
  unsubscribe: (callback: Subscription) => void;
  destroy: () => void;
};

type Component = IntrinsicComponent | ReactiveComponent;

// HTML Component Attributes
type ElementAttributes = {
  id?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  onClick?: (event: Event) => void;
};

const createId = () => Math.random().toString(36).substring(2, 7);

type Child = Component | Component[] | string;

const isComponent = (value: Child): value is Component => {
  return isObject(value);
};

const elementCreator =
  (tag: keyof HTMLElementTagNameMap) =>
  (attributes: ElementAttributes) =>
  (...children: Child[]): IntrinsicComponent => {
    let el = document.createElement(tag);

    const id = Math.random().toString(36).substring(2, 7);

    const childrenArray = children.flat();

    return {
      id,
      type: "intrinsic",
      element: () => el,
      render: () => {
        // how to turn this into a HTMLElement
        const newEl = document.createElement(tag);

        newEl.className = attributes.className ?? "";
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

        const onChildRender = (id: string) => {
          // find the child within the children array
          const child = childrenArray.find(
            (child) => isObject(child) && child.id === id
          );
          if (child && isComponent(child)) {
            const oldElement = child.element();
            const renderResult = child.render();
            console.log({ old: oldElement, new: renderResult });
            if (renderResult) {
              if (oldElement) {
                // replace the child element with the new one
                oldElement?.replaceWith(renderResult);
              } else {
                // find the place in the children array where the child is
                const index = children.indexOf(child);
                // insert the child element into the new element
                newEl.insertBefore(renderResult, newEl.children[index]);
              }
            } else {
              if (oldElement) {
                // remove the child element
                newEl.removeChild(oldElement);
                if (child.type === "reactive") {
                  child.destroy();
                }
              }
              // else the child element is already removed
            }
          }
        };

        childrenArray.forEach((child) => {
          if (isComponent(child)) {
            const renderResult = child.render();
            if (renderResult) {
              newEl.appendChild(renderResult);
            }
            if (child.type === "reactive") {
              child.subscribe(onChildRender);
            }
          } else {
            console.log("child", child);
            newEl.appendChild(document.createTextNode(child));
          }
        });

        el.replaceWith(newEl);

        el = newEl;

        return el;
      },
    };
  };

// default components
export const div = elementCreator("div");
export const span = elementCreator("span");
export const p = elementCreator("p");
export const h1 = elementCreator("h1");
export const h2 = elementCreator("h2");
export const h3 = elementCreator("h3");
export const h4 = elementCreator("h4");
export const h5 = elementCreator("h5");
export const h6 = elementCreator("h6");
export const ul = elementCreator("ul");
export const li = elementCreator("li");
export const a = elementCreator("a");
export const img = elementCreator("img");
export const button = elementCreator("button");
export const input = elementCreator("input");

// signals basics

type Listener<T> = () => T;

let currentListener: Listener<unknown> | undefined = undefined;

const createSignal = <T>(initialValue: T) => {
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

const createEffect = (callback: Listener<unknown>) => {
  currentListener = callback;
  callback();
  currentListener = undefined;
};

export const $signal = <T>(initialValue: T) => {
  const { read, write } = createSignal(initialValue);
  return [read, write] as const;
};

export const $effect = (callback: Listener<unknown>) => {
  createEffect(callback);
};

export const $bind = (callback: Listener<Component>): ReactiveComponent => {
  const bindId = createId();

  let renderResultComponent: Component | null = null;

  const subscriptions: Set<Subscription> = new Set();

  const bindComponent: ReactiveComponent = {
    id: bindId,
    type: "reactive",
    element: () => null,
    render: () => renderResultComponent?.render() ?? null,
    subscribe: (callback) => {
      subscriptions.add(callback);
    },
    unsubscribe: (callback) => {
      subscriptions.delete(callback);
    },
    destroy: () => {
      renderResultComponent?.type === "reactive" &&
        renderResultComponent.destroy();
    },
  };
  currentListener = () => {
    const childElement = renderResultComponent?.render();
    if (childElement) {
      bindComponent.element = () => childElement;
      bindComponent.render = () => renderResultComponent?.render() ?? null;
      subscriptions.forEach((callback) => callback(bindId));
    }
  };
  const result = callback();
  currentListener = undefined;
  renderResultComponent = result;
  return bindComponent;
};
