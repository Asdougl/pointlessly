import { $ } from "./render";

export type RawRenderable = Element | string;

export type Renderable = RawRenderable | ReturnType<ReturnType<typeof $>>;

const prepareToRender = (element: RawRenderable) => {
  if (typeof element === "string") {
    return document.createTextNode(element);
  } else {
    return element;
  }
};

export const renderTo = (root: Element) => (element: Renderable) => {
  if (typeof element === "string") {
    root.appendChild(document.createTextNode(element));
  } else if ("render" in element) {
    const rendered = element.render();
    root.appendChild(prepareToRender(rendered));
  } else {
    root.appendChild(element);
  }
};

type HTMLElementTagName = keyof HTMLElementTagNameMap;

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

function elementCreator<
  TagName extends HTMLElementTagName,
  Attributes extends Partial<
    HTMLElementTagNameMap[TagName] & ExtendedEventHandlerMap<TagName>
  >
>(tag: TagName) {
  return (props: Attributes) =>
    (...children: Renderable[]) => {
      const el = document.createElement(tag);

      console.log("RENDER");

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
        } else if (prop in el) {
          (el as any)[prop] = (props as any)[prop];
        }
      }

      if (props.id) {
        el.id = props.id;
      }

      if (props.className) {
        el.className = props.className;
      }

      if (props.style) {
        let styleString = "";
        Object.entries(props.style).forEach(([key, value]) => {
          styleString += `${key}: ${value};`;
        });
        el.style.cssText = styleString;
      }

      children.forEach(renderTo(el));
      return el;
    };
}

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

export type Component<Props extends Record<string, unknown> = {}> = (
  props: Props
) => Renderable;
