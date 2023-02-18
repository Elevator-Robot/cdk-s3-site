import { HostedSite } from "./index";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

describe("Test", () => {
    test("synthesizes the way we expect", () => {
        const app = new App();

        const stack = new Stack(app, "TestStack", 
        {
            env: {
                account: '123456789012',
                region: 'us-east-1'
            }
        });

        // Create the StateMachineStack.
        const site = new HostedSite(stack, "HostedSite", {
            zoneName: "elevator-robot.com",
            subDomain: "test",
            webAssetPath: "./",
        });

        // Assert that the template matches the expected one.
        Template.fromStack(stack).hasResourceProperties("AWS::S3::Bucket", {
            BucketEncryption: {
                ServerSideEncryptionConfiguration: [
                    {
                        ServerSideEncryptionByDefault: {
                            SSEAlgorithm: "AES256",
                        },
                    },
                ],
            },
            WebsiteConfiguration: {
                ErrorDocument: "index.html",
                IndexDocument: "index.html",
            },
        });

        Template.fromStack(stack).hasResourceProperties("AWS::Route53::RecordSet", {
            Name: "test.elevator-robot.com.",
            Type: "A",
        });

        Template.fromStack(stack).hasResourceProperties("AWS::CloudFront::Distribution", {
            DistributionConfig: {
                Aliases: [
                    "test.elevator-robot.com",
                ],
                DefaultCacheBehavior: {
                    AllowedMethods: [
                        "GET",
                        "HEAD",
                    ],
                    Compress: true,
                },
                Enabled: true,
            },
        });

    });

});