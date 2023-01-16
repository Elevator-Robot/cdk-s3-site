// const Template = require("aws-cdk-lib/assertions").Template;
// const App = require("aws-cdk-lib").App;
// const Stack = require("aws-cdk-lib").Stack;
// const HostedSite = require("./index").HostedSite;
import { HostedSite } from "./index";
import { App, Stack } from "aws-cdk-lib";
import { Template, Match, Capture } from "aws-cdk-lib/assertions";

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
        new HostedSite(stack, "HostedSite", {
            domainName: "example.com",
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
            Name: "example.com.",
            Type: "A",
        });

    });
});