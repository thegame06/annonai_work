# Spec Kit integration (experimental)

Spec Kit and Annona address different parts of the product-development loop:

> **Spec Kit organizes the process; Annona preserves and compiles the knowledge.**

Spec Kit artifacts are useful while a team is shaping a feature: specs, user stories,
acceptance criteria, implementation plans, technical decisions, and task lists keep the
work moving. Annona is useful after and during that flow because it turns those artifacts
into durable knowledge entities that can be validated, versioned, and compiled into the
smallest context an agent needs.

## Import command

The experimental CLI shape is:

```bash
annona import speckit <path>
```

`<path>` may point to one Markdown/text file or to a directory containing Spec Kit
artifacts. The importer scans `.md` and `.txt` files and writes Annona YAML files under
`annona/` in the current workspace.

## Initial mapping

The first implementation deliberately uses a small, predictable mapping:

| Spec Kit artifact | Annona entity |
| --- | --- |
| spec or feature document | `feature` |
| acceptance criteria or user stories | `requirement` |
| implementation plan or technical decisions | `adr` |
| task list | `task` |

Imported entities use `source: speckit` and the `speckit` tag so they can be reviewed,
edited, or replaced by curated Annona knowledge later.

## Review workflow

1. Run `annona import speckit <path>` from an initialized Annona workspace.
2. Review the generated YAML under `annona/features`, `annona/adrs`, and
   `annona/architecture` if future mappings add components.
3. Edit titles, statuses, relationships, and summaries as needed.
4. Run `annona check` and `annona compile`.

This import is intentionally a bridge, not a source-of-truth switch. The generated YAML
should be treated as a draft that helps teams preserve the reasoning captured during the
Spec Kit process.
