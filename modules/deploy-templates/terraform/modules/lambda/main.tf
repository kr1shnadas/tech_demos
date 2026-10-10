# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

variable "name_prefix" {
  type = string
}

variable "service_name" {
  type = string
}

variable "environment_name" {
  type = string
}

variable "image_uri" {
  type = string
}

variable "image_tag" {
  type = string
}

variable "memory" {
  type = number
}

variable "timeout" {
  type = number
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "${var.name_prefix}-lambda"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name_prefix}"
  retention_in_days = 14
}

resource "aws_lambda_function" "this" {
  function_name = var.name_prefix
  role          = aws_iam_role.this.arn
  package_type  = "Image"
  image_uri     = "${var.image_uri}:${var.image_tag}"
  memory_size   = var.memory
  timeout       = var.timeout
  architectures = ["x86_64"]

  environment {
    variables = {
      DEPLOY_SERVICE_NAME  = var.service_name
      DEPLOY_ENVIRONMENT   = var.environment_name
      DEPLOY_ENABLE_LAMBDA = "true"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.this,
    aws_iam_role_policy_attachment.basic,
  ]
}

output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}
