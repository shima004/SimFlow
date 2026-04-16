// Server-side application configuration helpers.
// Reads workflow template definitions from WORKFLOW_TEMPLATES env var.
import { env } from '$env/dynamic/private';

export type WorkflowTemplate = { value: string; label: string };

// Parses WORKFLOW_TEMPLATES env var.
// Format: "template-name:Label,template-name2:Label2"
// Example: "rrs-workflow-python:Python,rrs-workflow-java:Java"
// Falls back to built-in defaults when the env var is not set.
export function getWorkflowTemplates(): WorkflowTemplate[] {
	const raw = env.WORKFLOW_TEMPLATES;
	if (!raw) {
		return [
			{ value: 'rrs-workflow-python', label: 'Python' },
			{ value: 'rrs-workflow-java', label: 'Java' }
		];
	}
	return raw
		.split(',')
		.map((entry) => {
			const [value, label] = entry.trim().split(':');
			return { value: value.trim(), label: (label ?? value).trim() };
		})
		.filter((t) => t.value);
}
