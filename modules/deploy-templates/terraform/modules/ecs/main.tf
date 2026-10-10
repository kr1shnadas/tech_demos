# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

variable "name_prefix" {
  type = string
}

variable "service_name" {
  type = string
}

variable "region" {
  type = string
}

variable "environment_name" {
  type = string
}

variable "image_tag_strategy" {
  type = string
}

variable "image_uri" {
  type = string
}

variable "image_tag" {
  type = string
}

variable "container_port" {
  type = number
}

variable "cpu" {
  type = number
}

variable "memory" {
  type = number
}

variable "desired_count" {
  type = number
}

variable "enable_lambda" {
  type = bool
}

variable "vpc_id" {
  type = string
}

variable "task_subnet_ids" {
  type = list(string)
}

variable "assign_public_ip" {
  type = bool
}

variable "alb_security_group_id" {
  type = string
}

variable "target_group_arn" {
  type = string
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-exec"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-task"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name_prefix}"
  retention_in_days = 14
}

resource "aws_security_group" "task" {
  name        = "${var.name_prefix}-task"
  description = "Allow the container port from the load balancer."
  vpc_id      = var.vpc_id

  ingress {
    description     = "Container port from the load balancer"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    description = "Image pull and logs"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-task"
  }
}

resource "aws_ecs_cluster" "this" {
  name = var.name_prefix

  tags = {
    Name = var.name_prefix
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name_prefix
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.cpu)
  memory                   = tostring(var.memory)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = var.service_name
      image     = "${var.image_uri}:${var.image_tag}"
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "PORT", value = tostring(var.container_port) },
        { name = "DEPLOY_REGION", value = var.region },
        { name = "DEPLOY_SERVICE_NAME", value = var.service_name },
        { name = "DEPLOY_ENVIRONMENT", value = var.environment_name },
        { name = "DEPLOY_CONTAINER_PORT", value = tostring(var.container_port) },
        { name = "DEPLOY_CPU", value = tostring(var.cpu) },
        { name = "DEPLOY_MEMORY", value = tostring(var.memory) },
        { name = "DEPLOY_DESIRED_COUNT", value = tostring(var.desired_count) },
        { name = "DEPLOY_IMAGE_TAG_STRATEGY", value = var.image_tag_strategy },
        { name = "DEPLOY_IMAGE_TAG", value = var.image_tag },
        { name = "DEPLOY_ENABLE_LAMBDA", value = var.enable_lambda ? "true" : "false" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = var.region
          awslogs-stream-prefix = var.service_name
        }
      }
      healthCheck = {
        command = [
          "CMD-SHELL",
          "node -e \"fetch('http://127.0.0.1:${var.container_port}/health').then((res)=>process.exit(res.ok?0:1)).catch(()=>process.exit(1))\"",
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 40
      }
    }
  ])
}

resource "aws_ecs_service" "this" {
  name                               = var.name_prefix
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.this.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = var.task_subnet_ids
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = var.assign_public_ip
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.service_name
    container_port   = var.container_port
  }
}

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "service_name" {
  value = aws_ecs_service.this.name
}

output "task_security_group_id" {
  value = aws_security_group.task.id
}
