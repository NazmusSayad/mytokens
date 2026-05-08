# Confirmation Workflow

This skill must plan first and generate only after explicit approval.

## Required Order

1. Discover project evidence from the repository and user request.
2. Ask the user which artifact categories to generate.
3. Propose a final generation plan.
4. Wait for the exact phrase `Generate Artifacts Now`.
5. Generate only the approved artifacts.
6. Validate and reset the generated structure through LLM/agent file inspection so the files are internally consistent.

## Artifact Selection Question

Ask the user what to generate before writing files. Use the discovered project evidence to make the choices concrete.

Suggested categories:

- API artifacts: OpenAPI, GraphQL, or gRPC specs.
- Database artifacts: SQL schemas, NoSQL JSON schemas, or migration-derived schemas.
- Architecture diagrams: Mermaid diagrams with optional `context.json`.
- Documentation artifacts: README, markdown, HTML, PDF, or support docs.
- Test packs: smoke, regression, or manual test cases.
- Maps: maps, frames, focal points, and component links.
- Helper scripts: project-specific scripts under `.uigraph/scripts/`.

## Final Plan Format

Before generation, propose a final plan that includes:

- Artifact categories selected by the user.
- Files to create or update.
- Repository evidence used for each artifact.
- Assumptions that affect generated content.
- Helper scripts to create under `.uigraph/scripts/`, if useful.
- LLM validation checks to perform after generation.

Do not generate files in the same response as the final plan unless the user has already said `Generate Artifacts Now`.

## Approval Phrase

Only this exact phrase authorizes artifact generation:

```text
Generate Artifacts Now
```

If the user says anything else, ask them to confirm with the exact phrase.

## Helper Script Rules

Generated helper scripts must be written only under `.uigraph/scripts/`.

Scripts may help discover or derive artifacts from project evidence, such as:

- Existing API specs or route definitions.
- Serverless, deployment, or framework configuration.
- Migration folders and checked-in database schema files.
- ORM metadata or schema files.
- Existing docs and diagrams.

Do not create scripts in `scripts/`, `tools/`, or other project directories. Do not run live database dumps unless the user explicitly approves the database action and the project clearly contains the needed setup.

## Post-Generation Validation

After generation, the LLM/agent must verify and reset the generated structure by reading the generated files and reasoning through the rules.

- Check `.uigraph.yaml` is valid YAML.
- Check generated JSON files are valid JSON.
- Check every path referenced by `.uigraph.yaml` exists.
- Check OpenAPI, GraphQL, gRPC, SQL, Mermaid, and docs files are structurally plausible when generated.
- Check links between maps, test packs, APIs, docs, and architecture diagrams use matching names and operation IDs.
- Fix only files generated during the current execution.

Report any validation that cannot be performed and why.
