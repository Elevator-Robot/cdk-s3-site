const Template = require("aws-cdk-lib/assertions").Template;
const App = require("aws-cdk-lib").App;
const Stack = require("aws-cdk-lib").Stack;
const HostedSite = require("./index").HostedSite;

describe("Test", () => {
    test("synthesizes the way we expect", () => {
        const app = new App();

        const stack = new Stack(app, "TestStack");

        // Create the StateMachineStack.
        new HostedSite(stack, "HostedSite", {
            domainName: "example.com",
            webAssetPath: "dist",
        });
    
        // Prepare the stack for assertions.
        const template = Template.fromStack(stack);

    });
});
