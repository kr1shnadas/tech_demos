<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 Krishna Das
See NOTICE at the repository root.
-->

# Deployment templates

I ship a NestJS service as a container. The image sits in ECR. ECS Fargate runs it behind an application load balancer. GitHub Actions builds the image and applies the stack by assuming a role through OIDC. This module is that slice, small enough to clone and run without an AWS account.

## Setup

From the repository root, with Node.js 20 or newer:

```bash
pnpm install
pnpm --filter @krishnadas/deploy-templates dev
```

The process listens on http://localhost:3000.

| Path | What you get |
| --- | --- |
| http://localhost:3000/health | `{ "status": "ok", "service": "deploy-demo" }` |
| http://localhost:3000/version | service, environment, region, image tag, author |
| http://localhost:3000/info | same payload as `/version` |

The container is the same server:

```bash
cd modules/deploy-templates
docker compose up --build
```

Tests, the tfvars file, and the Terraform checks:

```bash
pnpm --filter @krishnadas/deploy-templates test
pnpm --filter @krishnadas/deploy-templates tfvars
terraform -chdir=modules/deploy-templates/terraform fmt -check -recursive
terraform -chdir=modules/deploy-templates/terraform init -backend=false
terraform -chdir=modules/deploy-templates/terraform validate
terraform -chdir=modules/deploy-templates/terraform test
```

`terraform test` plans the stack with a mock AWS provider. It does not call AWS. `pnpm tfvars` writes `terraform/terraform.tfvars` from the typed config. That file stays on your machine.

Copy `.env.example` to `.env` when you want to override a default. The demo process and `pnpm tfvars` both call `loadDeployConfig`.

The workflow template is `ci/deploy.yml`. Copy it to `.github/workflows/deploy.yml` in the service repository when you are ready to build and deploy. I keep it out of this repository's workflow directory so nothing here assumes a role or pushes an image.

Before that pipeline can apply, set two repository variables: `AWS_DEPLOY_ROLE_ARN` and `TF_STATE_BUCKET`. Optional variables `AWS_REGION`, `SERVICE_NAME`, `ENVIRONMENT_NAME`, `IMAGE_TAG_STRATEGY` and `ENABLE_LAMBDA` override the defaults below. The state file uses an S3 backend with the lockfile from Terraform 1.10, so a second apply sees the first. Local checks leave the backend on disk and do not need the bucket.

## Configuration

`defineDeployConfig` merges overrides onto the defaults. `loadDeployConfig` does the same from the environment. `toTfvars` is what Terraform reads, so the object is the source of truth.

```ts
import { defineDeployConfig } from "@krishnadas/deploy-templates";

export const deployConfig = defineDeployConfig({
  region: "eu-west-1",
  serviceName: "study-api",
  environmentName: "dev",
  imageTagStrategy: "git-sha",
});
```

| Field | Default | Meaning |
| --- | --- | --- |
| `region` | `us-east-1` | Region for every resource. Zones default to `{region}a` and `{region}b` when you leave them unset |
| `serviceName` | `deploy-demo` | Short name used in resource names |
| `containerPort` | `3000` | Port the container listens on. The load balancer calls `/health` |
| `cpu` | `256` | Fargate CPU units |
| `memory` | `512` | Fargate memory in MiB. It has to be a size AWS accepts for that CPU |
| `desiredCount` | `1` | Running tasks. `0` stops the tasks and leaves the service |
| `environmentName` | `dev` | Appended to resource names |
| `imageTagStrategy` | `git-sha` | `git-sha`, `semver` or `latest` |
| `imageTag` | `local` | Tag the task definition pins. CI sets this from the strategy |
| `enableLambda` | `false` | Also publish the image as a Lambda function |
| `lambdaMemory` | `512` | Lambda memory, used only when the switch is on |
| `lambdaTimeout` | `15` | Lambda timeout in seconds |
| `vpcCidr` | `10.40.0.0/16` | CIDR for the VPC |
| `availabilityZones` | `us-east-1a`, `us-east-1b` | Two zones |
| `enableNatGateway` | `false` | Private tasks and a NAT gateway when true |
| `deletionProtection` | `false` | Load balancer deletion protection |
| `enableGithubOidc` | `false` | Create the GitHub OIDC provider and the deploy role |
| `githubOrg` | empty | Required when OIDC is on |
| `githubRepo` | empty | Required when OIDC is on |
| `githubBranch` | `main` | Branch allowed to assume the deploy role |

`serviceName` and `environmentName` together stay at 24 characters or fewer, so the load balancer name fits. The repository name is `{serviceName}-{environmentName}`.

Environment variables use a `DEPLOY_` prefix: `DEPLOY_REGION`, `DEPLOY_SERVICE_NAME`, `DEPLOY_CONTAINER_PORT`, `DEPLOY_CPU`, `DEPLOY_MEMORY`, `DEPLOY_DESIRED_COUNT`, `DEPLOY_ENVIRONMENT`, `DEPLOY_IMAGE_TAG_STRATEGY`, `DEPLOY_IMAGE_TAG`, `DEPLOY_ENABLE_LAMBDA`, `DEPLOY_LAMBDA_MEMORY`, `DEPLOY_LAMBDA_TIMEOUT`, `DEPLOY_VPC_CIDR`, `DEPLOY_AVAILABILITY_ZONES` (comma-separated), `DEPLOY_ENABLE_NAT_GATEWAY`, `DEPLOY_DELETION_PROTECTION`, `DEPLOY_ENABLE_GITHUB_OIDC`, `DEPLOY_GITHUB_ORG`, `DEPLOY_GITHUB_REPO`, `DEPLOY_GITHUB_BRANCH`.

Booleans are the words `true` and `false`. When `DEPLOY_IMAGE_TAG` is unset, a `git-sha` strategy uses `GITHUB_SHA`, a `semver` strategy uses `DEPLOY_VERSION`, and a `latest` strategy uses the tag `latest`.

## Design

The service is a long-running HTTP process. Fargate matches that shape: a container, a port, a desired count, and a load balancer health check on `/health`. The default task is 0.25 vCPU and 512 MiB. I raise `cpu` and `memory` together when the process needs it, and the config rejects a combination Fargate will not start.

Lambda is a switch, off by default. I turn it on when the same image should answer a short request without a standing task. The image carries the Lambda Web Adapter under `/opt/extensions`. On Lambda, the extension proxies the invocation to the NestJS port. On Fargate the extension stays idle and the container command is the server. The load balancer targets the Fargate service. The function is a separate entry point, created only when `enableLambda` is true.

The workflow asks GitHub for an OIDC token (`id-token: write`) and `aws-actions/configure-aws-credentials` exchanges it for short-lived AWS credentials. The repository stores the role ARN in `AWS_DEPLOY_ROLE_ARN`. There is no access key in the workflow. Turning on `enableGithubOidc` creates the provider and a role whose trust policy allows `repo:ORG/REPO:ref:refs/heads/BRANCH` (main, unless you change `githubBranch`). An account only needs one provider for `token.actions.githubusercontent.com`, so I leave the switch off until I am applying in the account that should trust this repository. The role can create the resources in this stack. It is not an administrator role.

Image tags follow the strategy. `git-sha` and `semver` push an immutable tag, and the task definition pins that tag, so a running service does not move unless I deploy again. `latest` is mutable. I use it for a local experiment, not for an environment I share. ECR scans on push and keeps the last 20 images. The pipeline creates the repository first, pushes the tag, then applies the service, so the task pulls a tag that already exists.

The network is a small VPC with two public subnets and two private subnets. The load balancer is public. NAT is off, and the tasks use the public subnets with a public IP so they can pull from ECR. The task security group accepts traffic only from the load balancer. I turn NAT on when the tasks have to stay on private subnets. That choice is mostly about cost, below.

The listener is HTTP on port 80. Before I point a real hostname at it, I add an ACM certificate and a listener on 443. Leaving TLS out of the module means a plan does not need a certificate ARN.

State stays on the local disk for `terraform validate` and `terraform test`. The workflow copies `terraform/examples/backend.s3.tf` into place and inits with the state bucket, the key `{service}/{environment}/terraform.tfstate`, and `use_lockfile`. I want that remote state before anyone else applies the same stack.

When I want a plan against LocalStack, I copy `terraform/examples/localstack.tf` to `terraform/localstack.override.tf` and point the provider at `localhost:4566`. The check I actually run here is `terraform test`, because the mock provider needs no container and no account.

Kubernetes is the other place I run this image. On OpenShift I take the same container, the same port and the same `/health` check, and Argo CD syncs a Deployment and a Service. An EKS path would replace the ECS and load balancer modules with that chart. This module stops at ECS.

## Cost and teardown

Fargate bills for vCPU and memory while a task is running. One quarter vCPU and 512 MiB is the default. `desiredCount` of `0` stops that charge and leaves the service in place.

The application load balancer has an hourly charge whether or not it receives traffic. In a demo account it is the resource I remove first.

A NAT gateway is off by default. `enableNatGateway` adds an hourly charge and a per-gigabyte charge. A public task IP is the smaller charge I accept so the demo can pull an image without NAT.

ECR storage is the images. The lifecycle policy keeps 20. Log groups keep 14 days.

Lambda adds no resources while `enableLambda` is false. When the switch is on, the function is billed per request and per millisecond.

The workflow does not create a long-lived access key.

`deletionProtection` is false so destroy can remove the load balancer. I set it true only on an environment I intend to keep.

Tear the AWS stack down with the same config you applied:

```bash
pnpm --filter @krishnadas/deploy-templates tfvars
terraform -chdir=modules/deploy-templates/terraform destroy
```

Stop the local container with `docker compose down` from `modules/deploy-templates`.

## License

Apache-2.0. See [NOTICE](../../NOTICE) at the repository root. Copyright 2026 Krishna Das.
