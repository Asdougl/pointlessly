export const isObject = (
  value: unknown
): value is Record<string | number | symbol, unknown> => {
  return typeof value === "object" && value !== null;
};

export const isString = (value: unknown): value is string => {
  return typeof value === "string";
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === "number";
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === "boolean";
};

export const isFunction = (value: unknown): value is Function => {
  return typeof value === "function";
};

export const isArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value);
};

export const hasOwnProperty = <T extends object, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> => {
  return prop in obj;
};

export const hasOwnPropertyType = <T extends object, K extends PropertyKey, V>(
  obj: T,
  prop: K,
  type: (value: unknown) => value is V
): obj is T & Record<K, V> => {
  return hasOwnProperty(obj, prop) && type(obj[prop]);
};

export const isTextNode = (node: Node): node is Text => {
  return node.nodeType === Node.TEXT_NODE;
};

export const isDocumentFragment = (node: Node): node is DocumentFragment => {
  return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
};
