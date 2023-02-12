import { RemovalPolicy, CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { RecordTarget, ARecord, HostedZone } from 'aws-cdk-lib/aws-route53';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Distribution, AllowedMethods, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CloudFrontTarget,  } from 'aws-cdk-lib/aws-route53-targets';

// import {CfnRealtimeLogConfig} from 'aws-cdk-lib/aws-cloudfront';
// import { Stream } from 'aws-cdk-lib/aws-kinesis';

// import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';

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
    readonly websiteIndexDocument?: string;
    readonly websiteErrorDocument?: string;
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
            websiteIndexDocument: props.websiteIndexDocument || 'index.html',
            websiteErrorDocument: props.websiteErrorDocument || 'index.html',
            versioned: true,
            encryption: BucketEncryption.S3_MANAGED,
            serverAccessLogsBucket: new Bucket(stack, 'BucketAccessLogs', {
                removalPolicy: RemovalPolicy.DESTROY,
                autoDeleteObjects: true,
                versioned: false,
                encryption: BucketEncryption.S3_MANAGED,
            }),
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

        const distributionLogBucket = new Bucket(stack, 'DistributionLogBucket', {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            versioned: false,
            encryption: BucketEncryption.S3_MANAGED
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
            logBucket: distributionLogBucket
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

        // const stream = new Stream(stack, 'Stream', {
        //     shardCount: 1,
        //     retentionPeriod: Duration.days(1),
        // });

        // // create an IResolvable for the stream arn
        // const streamArn = stream.streamArn;

        // // create a new CloudFront Realtime Log role
        // const logRole = new Role(stack, 'LogRole', {
        //     assumedBy: new ServicePrincipal('cloudfront.amazonaws.com'),
        //     managedPolicies: [
        //         ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
        //     ]
        // });

        // new CfnRealtimeLogConfig(stack, 'RealtimeLogConfig', {
        //     endPoints: [
        //         {
        //             streamType: 'Kinesis',
        //             kinesisStreamConfig: {
        //                 streamArn: streamArn,
        //                 roleArn: logRole.roleArn
        //             }
        //         }
        //     ],
        //     name: 'CloudFrontRealtimeLogConfig',
        //     samplingRate: 100,
        //     fields: [
        //         'date',
        //         'time',
        //         'x-edge-location',
        //         'sc-bytes',
        //         'c-ip',
        //         'cs-method',
        //         'cs(Host)',
        //     ]
        // });

        new CfnOutput(stack, 'DomainName', {
            value: record.domainName,
        });
    }
}
