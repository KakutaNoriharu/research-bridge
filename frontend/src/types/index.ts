// ========== Enums ==========

export type UserRole = "researcher" | "company";

export type CollaborationType =
  | "joint_research"
  | "commissioned_research"
  | "consulting"
  | "poc";

export type InterestStatus = "pending" | "matched" | "withdrawn";

// ========== Users ==========

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

// ========== Researcher Profile ==========

export interface ResearcherProfile {
  id: string;
  user_id: string;
  name: string;
  university: string;
  lab?: string;
  position?: string;
  research_summary: string;
  keywords: string[];
  tech_stack: string[];
  publication_links: string[];
  collaboration_types: CollaborationType[];
  is_public: boolean;
  match_score?: number;
  updated_at: string;
}

// ========== Company Profile ==========

export interface CompanyProfile {
  id: string;
  user_id: string;
  company_name: string;
  industry: string;
  employee_count?: number;
  contact_name?: string;
  tech_needs: string;
  desired_fields: string[];
  collaboration_types: CollaborationType[];
  budget_range?: string;
  match_score?: number;
  updated_at: string;
}

// ========== Interest ==========

export interface Interest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: InterestStatus;
  created_at: string;
}

// ========== Match ==========

export interface Match {
  id: string;
  researcher_id: string;
  company_id: string;
  matched_at: string;
}

// ========== Message ==========

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

// ========== Notification ==========

export type NotificationType = "interest" | "match" | "message";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_user_id: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}
