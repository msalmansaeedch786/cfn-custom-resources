# cfn-custom-resources

## What are CloudFormation Custom Resources

CloudFormation custom resources enable you to write custom logic in your CloudFormation templates that will run when you create, update, or delete stacks. A custom resource allows you to extend the things that CloudFormation can do.  This project creates a Lambda that provides an extensible set of CloudFormation custom resources.

## Supported Custom Resources

The cfn-custom-resources Lambda provides the following custom resources out of the box:

| Custom Resource | Description |
|-----------------|-------------|
| Custom::AccessKey | The Custom::AccessKey custom resource creates an IAM Access Key and stores it in the SSM Parameter Store. It can also optionally create and store the SES SMTP password from the Access Key when it is created.  For more information see the [Custom::AccessKey documentation](./docs/custom-accesskey.md). |
| Custom:AMIInfo | The Custom::AMIInfo custom resource looks up the current Amazon Linux and Amazon Linux 2 AMI IDs based on the AWS region and either an EC2 instance type or architecture parameter. For more information see the [Custom::AMIInfo documentation](./docs/custom-amiinfo.md). |
| Custom::ImportKeyPair | The Custom::ImportKeyPair custom resource creates an EC2 Key Pair by importing public key material. For more information see the [Custom::ImportKeyPair documentation](./docs/custom-import-keypair.md). |
| Custom::KeyPair | The Custom::KeyPair custom resource creates an EC2 Key Pair and stores the SSH pem data in the SSM Parameter Store as a SecureString. For more information see the [Custom::KeyPair documentation](./docs/custom-keypair.md). |
| Custom::LogGroupSubscription | The Custom::LogGroupSubscription custom resource creates or updates a subscription filter and associates it with the specified log group. For more information see the [Custom::LogGroupSubscription documentation](./docs/custom-loggroup-subscription.md). |
| Custom::Secret | The Custom::Secret custom resource allows for secrets to be generated and stored in the SSM Parameter Store. For more information see the [Custom::Secret documentation](./docs/custom-secret.md). |

## The AWS Serverless Application Model (SAM)

The [AWS Serverless Application Model (SAM)](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/) is an open-source framework that can be used to build serverless applications on AWS.  SAM is basically an extension of AWS CloudFormation that makes it very straight forward to develop, debug, build and deploy serverless applications.
SAM provides the following:  

* Single-deployment configuration
* Extension of AWS CloudFormation
* Built-in best practices
* Local debugging and testing

SAM is used in all aspects of the SDLC of this project.

___

## Developer Workstation Set-Up
This project can be maintained and deployed on pretty much any type of developer workstation (Linux, Windows, and macOS) as long as the following are installed:

**Node.js**  
Node.js 10+ is required to perform builds and deploy the cfn-custom-resources lambda.  For more information on installing Node.js see [Node.js Downloads](https://nodejs.org/en/download/)

**AWS CLI**  
To use the SAM CLI ensure you have the latest version of the AWS CLI installed and configured on your workstation.  For more information on installing and updating the AWS CLI see [Installing the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)

**SAM CLI**  
The SAM CLI must be installed on your workstation to perform builds and deploys to AWS. For more information see [Installing the AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) 

___

## Installation

You must install the Node.js dependencies before deploying the cfn-custom-resources lambda.  To install the Node.js dependencies execute the following command from the root of this project:
```bash
npm install
```

To install the cfn-custom-resources lambda simply run the deploy script from the root of this project as follows:
```bash
./scripts/deploy-stack.js --env dev --s3-bucket devops-bucket
```
**REPLACE:**  
```dev``` with the name of the Environment (dev, test, staging, prod, etc.) you wish to deploy the lambda for  
 ```devops-bucket``` with the bucket name for the deployment artifacts  

## Cleanup (Stack Deletion)
To cleanup a deployment, simply execute the following command, this will delete the CloudFormation stack:
```bash
./scripts/delete-stack.js --env dev
```
**REPLACE:**  
 ```dev``` with the name of the Environment (dev, test, staging, prod, etc.) you wish to delete the stack from.  
