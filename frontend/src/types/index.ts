export type Role = 'RECRUITER' | 'APPLICANT';

export type ApplicationStatus = '지원함' | '수락됨' | '거절됨';

export interface User {
  id: string;
  email: string;
  role: Role;
  resume?: string | null;
  createdAt: string;
}

export interface Posting {
  id: string;
  title: string;           // 대회명
  originalUrl: string;     // 원문 대회 URL
  content: string;         // 모집 내용
  headcount: number;       // 모집 인원
  contactEmail: string;    // 연락 수단(이메일)
  authorId: string;
  authorEmail?: string;
  createdAt: string;
}

export interface Application {
  id: string;
  postingId: string;
  applicantId: string;
  content: string;         // 지원서 내용 (자기소개 등)
  status: ApplicationStatus;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PostingCreateRequest {
  title: string;
  originalUrl: string;
  content: string;
  headcount: number;
  contactEmail: string;
}

export interface PostingUpdateRequest extends Partial<PostingCreateRequest> {}

export interface ApplicationCreateRequest {
  postingId: string;
  content: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
