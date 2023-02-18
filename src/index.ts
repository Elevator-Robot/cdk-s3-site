import { RemovalPolicy, CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { RecordTarget, ARecord, HostedZone } from 'aws-cdk-lib/aws-route53';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Distribution, AllowedMethods, ViewerProtocolPolicy, PriceClass, SSLMethod } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';

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

    bucket: Bucket;
    distribution: Distribution;
    certificate: Certificate;
    constructor(scope: Construct, id: string, props: IStaticSiteProps) {
        super(scope, id);

        const stack = Stack.of(this);
        const bucket = new Bucket(stack, 'Bucket', {
            bucketName: `${stack.account}-bucket`,
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

        const certificate = new Certificate(stack, 'Certificate', {
            domainName: recordName,
            validation: CertificateValidation.fromDns(zone),
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
            sslSupportMethod: SSLMethod.SNI,
            enableLogging: true,
            logFilePrefix: `${stack.stackName}/distribution-logs`,
            defaultRootObject: 'index.html',
            logBucket: new Bucket(stack, 'DistributionLogBucket', {
                removalPolicy: RemovalPolicy.DESTROY,
                autoDeleteObjects: true,
                versioned: false,
                encryption: BucketEncryption.S3_MANAGED
            }),
            priceClass: PriceClass.PRICE_CLASS_100,
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

        this.bucket = bucket;
        this.distribution = distribution;
        this.certificate = certificate;

        new CfnOutput(stack, 'DomainName', {
            value: record.domainName,
        });

    }
}
