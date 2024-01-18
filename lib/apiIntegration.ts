import {
  ApiKeySourceType,
  AwsIntegration,
  EndpointType,
  JsonSchemaType,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { REGION } from "./common";
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { CfnOutput, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";

export const getApiIntegration = (
  scope: Construct,
  stateMachineArn: string,
  props: { methodPath: string }
) => {
  const integrationApi = new RestApi(scope, "IntegrationApi", {
    description: "Integration API to SFN",
    endpointTypes: [EndpointType.REGIONAL],
    apiKeySourceType: ApiKeySourceType.HEADER,
  });

  const plan = integrationApi.addUsagePlan("UsagePlan", {
    name: "general",
    throttle: {
      rateLimit: 10,
      burstLimit: 2,
    },
  });

  const key = integrationApi.addApiKey("ApiKey");
  plan.addApiKey(key);

  const apiGatewayStartUpdateIpSFNRole = new Role(
    scope,
    "ApiGatewayStartUpdateIpSFNRole",
    {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
      description: "Role for ApiGatewayStartUpdateIpSFN",
      maxSessionDuration: Duration.hours(1),
      inlinePolicies: {
        allowStartUpdateIpSFN: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["states:StartSyncExecution"],
              resources: [stateMachineArn],
            }),
          ],
        }),
      },
    }
  );

  const integration = new AwsIntegration({
    region: REGION,
    service: "states",
    action: "StartSyncExecution",
    options: {
      credentialsRole: apiGatewayStartUpdateIpSFNRole,
      requestTemplates: {
        "application/json": `#set($body= $input.json('$'))
  #set($inputRoot='{ "request" :'+$body+',"sourceIp":"'+ $context.identity.sourceIp+'"}')
  #set($apiData=$util.escapeJavaScript($inputRoot))
  #set($apiData=$apiData.replaceAll("\\'","'"))
  {
    "input" :"$apiData",
    "stateMachineArn": "${stateMachineArn}"  
  }`,
      },
      integrationResponses: [
        {
          statusCode: "200",
          responseTemplates: {
            "application/json": `#set ($bodyObj = $util.parseJson($input.body))
          
                #if ($bodyObj.status == "SUCCEEDED")
                    $bodyObj.output
                #elseif ($bodyObj.status == "FAILED")
                    #set($context.responseOverride.status = 500)
                    {
                        "cause": "$bodyObj.cause",
                        "error": "$bodyObj.error"
                    }
                #else
                    #set($context.responseOverride.status = 500)
                    $input.body
                #end`,
          },
        },
      ],
    },
  });

  integrationApi.root
    .resourceForPath(props.methodPath)
    .addMethod("POST", integration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: "200" }],
      requestValidatorOptions: {
        validateRequestBody: true,
      },
      requestModels: {
        "application/json": integrationApi.addModel("StartUpdateIpSFNModel", {
          modelName: "StartUpdateIpSFNBodyModel",
          contentType: "application/json",
          schema: {
            type: JsonSchemaType.OBJECT,
            properties: {
              ip: {
                type: JsonSchemaType.STRING,
                pattern: "^(?:\\d{1,3}\\.){3}\\d{1,3}$",
              },
            },
            additionalProperties: false,
            required: ["ip"],
          },
        }),
      },
    });

  new CfnOutput(scope, "IntegrationApiUrl", {
    value: integrationApi.urlForPath(props.methodPath),
  });

  new CfnOutput(scope, "IntegrationApiKey", {
    value: key.keyId,
  });
};
