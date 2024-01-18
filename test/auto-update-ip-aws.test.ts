import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AutoUpdateIpStack } from "../lib/auto-update-ip-aws-stack";

test("State machine created", () => {
  const app = new cdk.App();
  // WHEN
  const stack = new AutoUpdateIpStack(app, "MyTestStack", {
    hostedZoneId: "123456789",
    domaineName: "example.com",
  });
  // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
    StateMachineType: "EXPRESS",
  });
});
