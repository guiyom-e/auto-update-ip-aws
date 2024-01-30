import * as dotenv from "dotenv";
import { getEnvVar } from "./helpers";

dotenv.config();

export const REGION = getEnvVar("REGION");
export const DOMAIN_NAME = getEnvVar("DOMAIN_NAME");

export const HOSTED_ZONE_ID = getEnvVar("HOSTED_ZONE_ID");

export const API_INTEGRATION_PATH = getEnvVar("API_INTEGRATION_PATH");
export const FETCH_IP_API_PATH = getEnvVar("FETCH_IP_API_PATH");
