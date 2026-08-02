// @ts-nocheck
import { buildPersonalExportPdf } from "./personalExport.js";

function safeJsonParse(raw, fallback) {
  if (raw && typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw ?? ""));
  } catch {
    return fallback;
  }
}

export async function createPersonalDataExport(connection, exportUser) {
  const [problemsetRows] = await connection.query(
    `
      SELECT p.id, p.title, p.description, p.duration_minutes, p.problemset_type, p.created_at, COUNT(q.id) AS question_count
      FROM problemsets p
      LEFT JOIN questions q ON q.problemset_id = p.id
      WHERE p.created_by_uid = ?
      GROUP BY p.id, p.title, p.description, p.duration_minutes, p.problemset_type, p.created_at
      ORDER BY p.created_at ASC, p.id ASC
    `,
    [String(exportUser.uid)]
  );
  const [questionRows] = await connection.query(
    `
      SELECT
        q.id, q.problemset_id, q.question_index, q.question_type, q.group_title,
        q.shared_material, q.stem, q.input_placeholder, q.options_json,
        q.score, q.answer, q.analysis
      FROM questions q
      INNER JOIN problemsets p ON p.id = q.problemset_id
      WHERE p.created_by_uid = ?
      ORDER BY q.problemset_id ASC, q.question_index ASC
    `,
    [String(exportUser.uid)]
  );
  const [submissionRows] = await connection.query(
    `
      SELECT
        s.id, s.problemset_id, COALESCE(p.title, '') AS problemset_title,
        s.mode, s.status, s.score, s.max_score, s.started_at, s.submitted_at, s.created_at
      FROM submissions s
      LEFT JOIN problemsets p ON p.id = s.problemset_id
      WHERE s.user_uid = ?
      ORDER BY s.created_at ASC, s.id ASC
    `,
    [String(exportUser.uid)]
  );

  const exportedAt = new Date();
  const questionsByProblemset = new Map();
  for (const row of questionRows) {
    const problemsetId = Number(row.problemset_id);
    const options = safeJsonParse(row.options_json, []);
    const question = {
      id: Number(row.id),
      index: Number(row.question_index),
      type: String(row.question_type ?? ""),
      groupTitle: String(row.group_title ?? ""),
      sharedMaterial: String(row.shared_material ?? ""),
      stem: String(row.stem ?? ""),
      inputPlaceholder: String(row.input_placeholder ?? ""),
      options: Array.isArray(options)
        ? options.map((option) => ({ key: String(option?.key ?? ""), text: String(option?.text ?? "") }))
        : [],
      score: Number(row.score ?? 0),
      answer: String(row.answer ?? ""),
      analysis: String(row.analysis ?? "")
    };
    const questions = questionsByProblemset.get(problemsetId) ?? [];
    questions.push(question);
    questionsByProblemset.set(problemsetId, questions);
  }

  const pdf = await buildPersonalExportPdf({
    user: {
      id: Number(exportUser.id),
      uid: String(exportUser.uid ?? ""),
      name: String(exportUser.name ?? ""),
      email: String(exportUser.email ?? ""),
      avatarUrl: String(exportUser.avatar_url ?? ""),
      profileCoverUrl: String(exportUser.profile_cover_url ?? ""),
      bio: String(exportUser.bio ?? ""),
      recordsPublic: Boolean(exportUser.records_public),
      createdAt: exportUser.created_at
    },
    problemsets: problemsetRows.map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      problemsetType: String(row.problemset_type ?? ""),
      durationMinutes: Number(row.duration_minutes ?? 0),
      questionCount: Number(row.question_count ?? 0),
      createdAt: row.created_at,
      questions: questionsByProblemset.get(Number(row.id)) ?? []
    })),
    submissions: submissionRows.map((row) => ({
      id: Number(row.id),
      problemsetId: Number(row.problemset_id),
      problemsetTitle: String(row.problemset_title ?? ""),
      mode: String(row.mode ?? ""),
      status: String(row.status ?? ""),
      score: Number(row.score ?? 0),
      maxScore: Number(row.max_score ?? 0),
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      createdAt: row.created_at
    })),
    exportedAt
  });

  const datePart = exportedAt.toISOString().slice(0, 10);
  const safeUid = String(exportUser.uid).replace(/[^A-Za-z0-9_-]/g, "_");
  return {
    pdf,
    filename: `ti-personal-data-${safeUid}-${datePart}.pdf`
  };
}
