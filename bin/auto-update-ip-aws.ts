#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AutoUpdateIpStack } from "../lib/auto-update-ip-aws-stack";
import {
  API_INTEGRATION_PATH,
  FETCH_IP_API_PATH,
  DOMAIN_NAME,
  HOSTED_ZONE_ID,
  REGION,
} from "../lib/common";

const app = new cdk.App();

new AutoUpdateIpStack(app, "AutoUpdateIpStack", {
  hostedZoneId: HOSTED_ZONE_ID,
  domaineName: DOMAIN_NAME,
  apiIntegration: {
    methodPath: API_INTEGRATION_PATH,
  },
  fetchIpApi: { methodPath: FETCH_IP_API_PATH },
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: REGION,
  },
});
