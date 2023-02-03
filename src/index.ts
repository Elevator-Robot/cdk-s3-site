import { RemovalPolicy, CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { RecordTarget, ARecord, HostedZone } from 'aws-cdk-lib/aws-route53';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Distribution, AllowedMethods, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Effect } from 'aws-cdk-lib/aws-iam';

/**
 * IStaticSiteProps
 * @readonly
 * @property domainName   - domain name to depoy for
 * @property webAssetPath -  Path to your web asset build folder [e.g. .dist || .build || .out]
 */
interface IStaticSiteProps {
    readonly zoneName: string;
    readonly webAssetPath: string;
    readonly subDomain?: string;
}

/**
 * Hosted Site Construct
 */
export class HostedSite extends Construct {
    /**
     * @param scope - scope as Construct
     * @param id    - identifier
     * @param props - IStaticSiteProps
     */
    constructor(scope: Construct, id: string, props: IStaticSiteProps) {
        super(scope, id);

        const stack = Stack.of(this);

        const bucket = new Bucket(stack, 'Bucket', {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html',
            versioned: true,
            encryption: BucketEncryption.S3_MANAGED,
        });

        bucket.grantPublicAccess('*', 's3:GetObject');

        const zone = HostedZone.fromLookup(stack, 'Zone', {
            domainName: props.zoneName,
        });

        const recordName = props.subDomain ? `${props.subDomain}.${zone.zoneName}` : zone.zoneName;

        const certificate = new DnsValidatedCertificate(stack, 'Certificate', {
            domainName: recordName,
            hostedZone: zone,
            region: stack.region
        });

        const distribution = new Distribution(stack, 'Distribution', {
            defaultBehavior: {
                origin: new S3Origin(bucket),
                allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            },
            enabled: true,
            domainNames: [recordName],
            certificate: certificate,
            enableLogging: true,
            logFilePrefix: 'aaronwest.me/distribution-logs',
            defaultRootObject: 'index.html',
        });

        new BucketDeployment(stack, 'DeployToBucket', {
            sources: [Source.asset(props.webAssetPath)],
            destinationBucket: bucket,
            distribution,
            distributionPaths: ['/*'],
        });

        const record = new ARecord(stack, 'AliasRecord', {
            zone,
            recordName,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
            deleteExisting: true,
            ttl: Duration.seconds(30),
        });

        new CfnOutput(stack, 'DomainName', {
            value: record.domainName,
        });
    }
}
