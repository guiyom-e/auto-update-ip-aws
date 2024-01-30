export const getEnvVar = (name: string): string => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`${name} is undefined`);
  }
  return value;
};
