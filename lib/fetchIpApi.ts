import { CfnOutput } from "aws-cdk-lib";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Function, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export const getFetchIpApi = (
  scope: Construct,
  stateMachineArn: string,
  props: { methodPath: string }
) => {
  const coreApi = new HttpApi(scope, "CoreApi", {
    description: "Core API",
  });

  // Lambda function to get IP address
  const lambdaFunction = new Function(scope, "FetchIp", {
    code: Code.fromInline(
      "module.exports = { handler: async (event) => { const ip = event?.requestContext?.http?.sourceIp; if (ip === undefined || ip.match(/^(?:\\d{1,3}\\.){3}\\d{1,3}$/g) === null) {  return { statusCode: 400, body: `invalid ip ${ip}` }; } return { ip }; } }"
    ),
    handler: "index.handler",
    runtime: Runtime.NODEJS_20_X,
    environment: {
      STATE_MACHINE_ARN: stateMachineArn,
    },
  });

  coreApi.addRoutes({
    integration: new HttpLambdaIntegration(
      "FetchIpIntegration",
      lambdaFunction
    ),
    path: props.methodPath,
    methods: [HttpMethod.GET],
  });

  new CfnOutput(scope, "FetchIpApiUrl", {
    value: coreApi.apiEndpoint + props.methodPath,
  });
};
