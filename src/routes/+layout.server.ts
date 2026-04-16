// Pass authenticated user info and app-wide config to all pages via layout data.
import { getWorkflowTemplates } from '$lib/config';
import { getAgentsBucket, getMapsBucket } from '$lib/s3';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		workflowTemplates: getWorkflowTemplates(),
		agentsBucket: getAgentsBucket(),
		mapsBucket: getMapsBucket()
	};
};
