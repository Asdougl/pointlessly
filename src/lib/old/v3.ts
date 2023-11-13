type Attributes = {
  id?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  onClick?: (event: Event) => void;
};

type BindNodeSubscription = (
  id: string,
  oldElement: HTMLElement | null,
  newElement: HTMLElement | null
) => void;

type BindNode = {
  render: () => HTMLElement | Text;
  element: HTMLElement | Text | null;
  id: string;
  subscribe: (callback: BindNodeSubscription) => void;
  unsubscribe: (callback: BindNodeSubscription) => void;
  destroy: () => void;
};

const elementCreator =
  (tag: keyof HTMLElementTagNameMap) =>
  (attributes: Attributes, ...children: BindNode[]): BindNode => {
    let el = document.createElement(tag);

    const renderListeners = new Set<BindNodeSubscription>();

    const id = Math.random().toString(36).substring(2, 7);

    return {
      id,
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
          const child = children.find((child) => child.id === id);
          if (child) {
            if (child.element) {
              // replace the child element with the new one
              newEl.replaceChild(child.render(), child.element);
            } else {
              // find the place in the children array where the child is
              const index = children.indexOf(child);
              // insert the child element into the new element
              newEl.insertBefore(child.render(), newEl.children[index]);
            }
          }
        };

        children.forEach((child) => {
          newEl.appendChild(child.render());
          child.subscribe(onChildRender);
        });

        el.replaceWith(newEl);

        el = newEl;

        return el;
      },
      element: el, // optional for virtual nodes
      subscribe: (callback) => {
        renderListeners.add(callback);
      },
      unsubscribe: (callback) => {
        renderListeners.delete(callback);
      },
      destroy: () => {
        renderListeners.clear();
      },
    };
  };
