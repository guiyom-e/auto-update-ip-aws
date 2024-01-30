import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AutoUpdateIpStack } from "../lib/auto-update-ip-aws-stack";
import { getEnvVar } from "../lib/helpers";

test("State machine created", () => {
  const app = new cdk.App();

  const stack = new AutoUpdateIpStack(app, "MyTestStack", {
    hostedZoneId: getEnvVar("HOSTED_ZONE_ID"),
    domaineName: getEnvVar("DOMAIN_NAME"),
  });

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::IAM::Role", {
    Policies: [
      {
        PolicyDocument: {
          Statement: [
            {
              Action: "route53:ChangeResourceRecordSets",
              Condition: {
                "ForAllValues:StringEquals": {
                  "route53:ChangeResourceRecordSetsActions": "UPSERT",
                  "route53:ChangeResourceRecordSetsNormalizedRecordNames":
                    "toto.example.com",
                  "route53:ChangeResourceRecordSetsRecordTypes": "A",
                },
              },
              Effect: "Allow",
              Resource: "arn:aws:route53:::hostedzone/ABC",
            },
          ],
          Version: "2012-10-17",
        },
        PolicyName: "allowARecordChange",
      },
      {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                "logs:CreateLogDelivery",
                "logs:DeleteLogDelivery",
                "logs:DescribeLogGroups",
                "logs:DescribeResourcePolicies",
                "logs:GetLogDelivery",
                "logs:ListLogDeliveries",
                "logs:PutResourcePolicy",
                "logs:UpdateLogDelivery",
              ],
              Effect: "Allow",
              Resource: "*",
            },
          ],
          Version: "2012-10-17",
        },
        PolicyName: "logs",
      },
    ],
  });

  template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
    StateMachineType: "EXPRESS",
  });
});

test("REST API for integration created", () => {
  const app = new cdk.App();
  const region = getEnvVar("REGION");

  const stack = new AutoUpdateIpStack(app, "MyTestStack", {
    hostedZoneId: getEnvVar("HOSTED_ZONE_ID"),
    domaineName: getEnvVar("DOMAIN_NAME"),
    apiIntegration: { methodPath: getEnvVar("API_INTEGRATION_PATH") },
  });

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::ApiGateway::RestApi", {
    ApiKeySourceType: "HEADER",
    EndpointConfiguration: {
      Types: ["REGIONAL"],
    },
  });
  template.hasResourceProperties("AWS::ApiGateway::Stage", {
    StageName: "prod",
  });

  template.hasResourceProperties("AWS::ApiGateway::Method", {
    ApiKeyRequired: true,
    AuthorizationType: "NONE",
    HttpMethod: "POST",
    Integration: {
      IntegrationHttpMethod: "POST",
      Type: "AWS",
      Uri: {
        "Fn::Join": [
          "",
          [
            "arn:",
            { Ref: "AWS::Partition" },
            `:apigateway:${region}:states:action/StartSyncExecution`,
          ],
        ],
      },
    },
    MethodResponses: [{ StatusCode: "200" }],
  });

  template.hasResourceProperties("AWS::ApiGateway::ApiKey", { Enabled: true });
});

test("HTTP API for fetch IP created", () => {
  const app = new cdk.App();

  const stack = new AutoUpdateIpStack(app, "MyTestStack", {
    hostedZoneId: getEnvVar("HOSTED_ZONE_ID"),
    domaineName: getEnvVar("DOMAIN_NAME"),
    fetchIpApi: { methodPath: getEnvVar("FETCH_IP_API_PATH") },
  });

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
    ProtocolType: "HTTP",
  });

  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.handler",
    Runtime: "nodejs20.x",
    Architectures: ["arm64"],
    Timeout: 10,
  });
});
