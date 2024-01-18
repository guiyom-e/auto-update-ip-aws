import { Construct } from "constructs";
import {
  ChainDefinitionBody,
  Choice,
  Condition,
  Fail,
  JsonPath,
  LogLevel,
  StateMachine,
  StateMachineType,
} from "aws-cdk-lib/aws-stepfunctions";
import { CallAwsService } from "aws-cdk-lib/aws-stepfunctions-tasks";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import {
  Effect,
  Group,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
  User,
} from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

import { getApiIntegration } from "./apiIntegration";
import { getFetchIpApi } from "./fetchIpApi";

export class AutoUpdateIpStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    {
      hostedZoneId,
      domaineName,
      apiIntegration,
      fetchIpApi,
      user,
      ...stackProps
    }: StackProps & {
      hostedZoneId: string;
      domaineName: string;
      apiIntegration?: { methodPath: string };
      fetchIpApi?: { methodPath: string };
      user?: { userName: string; groupName: string };
    }
  ) {
    super(scope, id, stackProps);

    const role = new Role(this, "UpdateIpSFNRole", {
      assumedBy: new ServicePrincipal("states.amazonaws.com"),
      description: "Role for UpdateIpSFN",
      maxSessionDuration: Duration.hours(1),
      inlinePolicies: {
        allowARecordChange: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["route53:ChangeResourceRecordSets"],
              resources: [`arn:aws:route53:::hostedzone/${hostedZoneId}`],
              conditions: {
                "ForAllValues:StringEquals": {
                  "route53:ChangeResourceRecordSetsActions": "UPSERT",
                  "route53:ChangeResourceRecordSetsNormalizedRecordNames":
                    domaineName,
                  "route53:ChangeResourceRecordSetsRecordTypes": "A",
                },
              },
            }),
          ],
        }),
        logs: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                "logs:CreateLogDelivery",
                "logs:DeleteLogDelivery",
                "logs:DescribeLogGroups",
                "logs:DescribeResourcePolicies",
                "logs:GetLogDelivery",
                "logs:ListLogDeliveries",
                "logs:PutResourcePolicy",
                "logs:UpdateLogDelivery",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
      // Do not use CDK automated policy updates, because it does not add the condition on records
    }).withoutPolicyUpdates();

    const changeRecordStep = new CallAwsService(
      this,
      "StartNextcloudRemoteTask",
      {
        service: "route53",
        action: "changeResourceRecordSets",
        iamResources: [`arn:aws:route53:::hostedzone/${hostedZoneId}`],
        parameters: {
          ChangeBatch: {
            Changes: [
              {
                Action: "UPSERT",
                ResourceRecordSet: {
                  Name: `${domaineName}.`,
                  Type: "A",
                  ResourceRecords: [
                    {
                      Value: JsonPath.stringAt("$.request.ip"),
                    },
                  ],
                  Ttl: 300,
                },
              },
            ],
          },
          HostedZoneId: hostedZoneId,
        },
      }
    );

    const stateMachine = new StateMachine(this, "UpdateIpSFN", {
      stateMachineType: StateMachineType.EXPRESS,
      role,
      logs: {
        destination: new LogGroup(this, "UpdateIpSFNLogGroup", {
          retention: RetentionDays.SIX_MONTHS,
          removalPolicy: RemovalPolicy.RETAIN,
        }),
        includeExecutionData: true,
        level: LogLevel.ALL,
      },
      definitionBody: ChainDefinitionBody.fromChainable(
        // Check for when using api integration: ensure the API caller has the same IP as the requested one.
        new Choice(this, "IsIpValid", {})
          .when(
            Condition.stringEqualsJsonPath("$.request.ip", "$.sourceIp"),
            changeRecordStep
          )
          .otherwise(
            new Fail(this, "InvalidIp", {
              error: "IPDoesNotMatch",
              cause: "Source IP does not match request IP",
            })
          )
      ),
    });

    new CfnOutput(this, "UpdateIpSFNArn", {
      value: stateMachine.stateMachineArn,
    });

    // IAM User to start the state machine
    if (user !== undefined) {
      const startSFNGroup = new Group(this, "StartUpdateIpSFNGroup", {
        groupName: user.groupName,
      });

      startSFNGroup.attachInlinePolicy(
        new Policy(this, "StartUpdateIpSFNPolicy", {
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["states:StartSyncExecution"],
              resources: [stateMachine.stateMachineArn],
            }),
          ],
        })
      );

      startSFNGroup.addUser(
        new User(this, "StartUpdateIpSFNUser", {
          userName: user.userName,
        })
      );
    }

    // API to integrate step functions
    if (apiIntegration !== undefined) {
      getApiIntegration(this, stateMachine.stateMachineArn, apiIntegration);
    }

    // API to get IP address
    if (fetchIpApi !== undefined) {
      getFetchIpApi(this, stateMachine.stateMachineArn, fetchIpApi);
    }
  }
}
