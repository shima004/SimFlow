// RoboCup Rescue scoring (RoboCup 2025 rules).
// Reference: competition rulebook.
const SDC = 2;

export type RankingEntry = {
	agent: string;
	fts: number;
	rank: number;
	tpByMap: Record<string, number>;
};

/**
 * Compute per-agent ranking for one competition session.
 *
 * @param agents  All agent names registered in the competition
 * @param maps    All map names registered in the competition
 * @param scores  scores[agent][map] = raw numeric score, or null if not yet run
 */
export function computeCompetitionRanking(
	agents: string[],
	maps: string[],
	scores: Record<string, Record<string, number | null>>
): RankingEntry[] {
	const agentFTS: Record<string, number> = {};
	const agentTPByMap: Record<string, Record<string, number>> = {};
	for (const agent of agents) {
		agentFTS[agent] = 0;
		agentTPByMap[agent] = {};
		for (const map of maps) {
			agentTPByMap[agent][map] = 0;
		}
	}

	for (const map of maps) {
		// Only agents with a valid score participate in this map's ranking.
		const participants: { agent: string; score: number }[] = [];
		for (const agent of agents) {
			const sc = scores[agent]?.[map];
			if (sc != null && !isNaN(sc)) {
				participants.push({ agent, score: sc });
			}
		}
		if (participants.length === 0) continue;

		const n = participants.length;
		const MS = n * SDC;
		const uniqueScores = [...new Set(participants.map((participant) => participant.score))].sort(
			(a, b) => b - a
		);
		const rankByScore = new Map<number, number>();
		uniqueScores.forEach((score, rank) => {
			rankByScore.set(score, rank);
		});

		for (const { agent, score } of participants) {
			const rank = rankByScore.get(score) ?? 0;
			const tp = MS - rank;

			agentFTS[agent] += tp;
			agentTPByMap[agent][map] = tp;
		}
	}

	// Sort by FTS descending
	const sorted = [...agents]
		.map((agent) => ({ agent, fts: agentFTS[agent], tpByMap: agentTPByMap[agent] }))
		.sort((a, b) => b.fts - a.fts);

	// Assign ranks (ties share the same rank)
	let rank = 1;
	return sorted.map((entry, i) => {
		if (i > 0 && entry.fts < sorted[i - 1].fts) rank = i + 1;
		return { ...entry, rank };
	});
}
