export const id = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const isSameProps = (
  a: Record<string, unknown>,
  b: Record<string, unknown>
) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => {
    return Object.is(a[key], b[key]);
  });
};

export const isSameDependencies = (a: unknown[], b: unknown[]) => {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => {
    return Object.is(value, b[index]);
  });
};
