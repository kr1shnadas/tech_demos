# Fullstack Modules

Hi, I'm Krishna Das, a Senior Fullstack Developer working with Node.js, NestJS, TypeScript, React, Angular, Vue and AWS.

This repository is my collection of reusable, production-grade fullstack building blocks. Each module lives under `modules/<name>/` and is atomic: it ships as its own package with typed configuration, a small demo app, tests and a README of its own. You can run, configure and reuse any module independently of the rest of the repository.

I add modules over time as I extract and polish patterns from real projects, so the list below will grow.

## Planned modules

- GxP audit trail
- Authentication and role-based access
- Search
- Electronic signatures
- File storage on S3
- Background jobs
- Microfrontend shell
- Observability
- Deployment templates

## Running a module

Requirements: Node.js 20 or newer and [pnpm](https://pnpm.io/). Some modules also use Docker Compose for local infrastructure (databases, queues, object storage); each module's README says whether it needs one.

```bash
# install workspace dependencies from the repository root
pnpm install

# run a module's demo app
cd modules/<name>
pnpm dev

# run a module's tests
pnpm test
```

The repository is a pnpm workspace (`pnpm-workspace.yaml`), so modules can be developed together while staying independently publishable and runnable. Each module documents its own configuration through a typed config object, with sane defaults and environment variable overrides.

## Attribution

This project is licensed under the [Apache License 2.0](./LICENSE) and includes a [NOTICE](./NOTICE) file. Under section 4(d) of the license, if you redistribute this work or build derivative works from it, you must retain the NOTICE file and give visible credit to me, Krishna Das ([github.com/kr1shnadas](https://github.com/kr1shnadas)). If a module saves you time, a link back is appreciated.
