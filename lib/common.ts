import * as dotenv from "dotenv";

dotenv.config();

const getEnvVar = (name: string): string => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`${name} is undefined`);
  }
  return value;
};

export const REGION = getEnvVar("REGION");
export const DOMAIN_NAME = getEnvVar("DOMAIN_NAME");

export const HOSTED_ZONE_ID = getEnvVar("HOSTED_ZONE_ID");

export const API_INTEGRATION_PATH = getEnvVar("API_INTEGRATION_PATH");
export const FETCH_IP_API_PATH = getEnvVar("FETCH_IP_API_PATH");
