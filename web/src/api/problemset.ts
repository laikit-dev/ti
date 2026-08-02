import { apiDelete, apiGet, apiPatch, apiPost } from "../api";

export interface ProblemsetSummary {
  id: number;
  title: string;
  description: string;
  questionCount: number;
  durationHours: number;
  problemsetType: "official_public" | "personal_featured" | "personal_public" | "personal_private";
  createdByUid?: string;
}

export interface ChoiceOption {
  key: string;
  text: string;
}

export interface ProblemQuestion {
  id: string;
  index: number;
  type: "option" | "input";
  materialGroupIndex: number | null;
  groupQuestionIndex: number | null;
  groupQuestionCount: number | null;
  groupTitle: string;
  sharedMaterial: string;
  stem: string;
  inputPlaceholder: string;
  options: ChoiceOption[];
  score: number;
  answer: string;
  analysis: string;
}

export interface ProblemsetDetail {
  summary: ProblemsetSummary;
  author: {
    uid: string;
    username: string;
    avatarUrl: string;
  };
  questions: ProblemQuestion[];
}

export interface ProblemsetEditDetail {
  id: number;
  title: string;
  description: string;
  durationMinutes: number;
  questionConfig: string;
  problemsetType: "official_public" | "personal_featured" | "personal_public" | "personal_private";
  createdByUid: string;
}

export interface CreateProblemsetPayload {
  id?: number;
  title: string;
  description: string;
  durationMinutes: number;
  questionConfig: string;
  problemsetType: "official_public" | "personal_featured" | "personal_public" | "personal_private";
}

interface ProblemsetListResponse {
  problemsets: ProblemsetSummary[];
}

interface UserProblemsetListResponse {
  problemsets: ProblemsetSummary[];
}

interface ProblemsetCreateResponse {
  problemset: ProblemsetSummary;
}

interface ProblemsetEditResponse {
  problemset: ProblemsetEditDetail;
}

export interface ProblemsetApi {
  list(tab?: "official" | "all" | "featured"): Promise<ProblemsetSummary[]>;
  search(keyword: string): Promise<ProblemsetSummary[]>;
  detail(problemsetId: number): Promise<ProblemsetDetail>;
  create(payload: CreateProblemsetPayload): Promise<ProblemsetSummary>;
  getEditable(problemsetId: number): Promise<ProblemsetEditDetail>;
  update(problemsetId: number, payload: CreateProblemsetPayload): Promise<ProblemsetSummary>;
  delete(problemsetId: number): Promise<void>;
  listUserProblemsets(uid: string): Promise<ProblemsetSummary[]>;
}

class HttpProblemsetApi implements ProblemsetApi {
  async list(tab: "official" | "all" | "featured" = "official"): Promise<ProblemsetSummary[]> {
    const remote = await apiGet<ProblemsetListResponse>(`/api/problemsets?tab=${tab}`);
    return remote.problemsets ?? [];
  }

  async search(keyword: string): Promise<ProblemsetSummary[]> {
    const remote = await apiGet<ProblemsetListResponse>(`/api/problemsets/search?q=${encodeURIComponent(keyword)}`);
    return remote.problemsets ?? [];
  }

  async detail(problemsetId: number): Promise<ProblemsetDetail> {
    return apiGet<ProblemsetDetail>(`/api/problemsets/${problemsetId}`);
  }

  async create(payload: CreateProblemsetPayload): Promise<ProblemsetSummary> {
    const result = await apiPost<ProblemsetCreateResponse>("/api/problemsets", payload);
    return result.problemset;
  }

  async getEditable(problemsetId: number): Promise<ProblemsetEditDetail> {
    const result = await apiGet<ProblemsetEditResponse>(`/api/problemsets/${problemsetId}/edit`);
    return result.problemset;
  }

  async update(problemsetId: number, payload: CreateProblemsetPayload): Promise<ProblemsetSummary> {
    const result = await apiPatch<ProblemsetCreateResponse>(`/api/problemsets/${problemsetId}`, payload);
    return result.problemset;
  }

  async delete(problemsetId: number): Promise<void> {
    await apiDelete(`/api/problemsets/${problemsetId}`);
  }

  async listUserProblemsets(uid: string): Promise<ProblemsetSummary[]> {
    const result = await apiGet<UserProblemsetListResponse>(`/api/users/${encodeURIComponent(uid)}/problemsets`);
    return result.problemsets ?? [];
  }
}

export const problemsetApi: ProblemsetApi = new HttpProblemsetApi();
