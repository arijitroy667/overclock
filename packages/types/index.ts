// API shapes shared by apps/mobile and apps/web (mirror of services/api schemas).
export type Subtask = { id: string; title: string; order_index: number; status: string };
export type Task = {
  id: string;
  raw_input_text: string;
  status: string;
  category: string | null;
  reframed_title: string | null;
  first_step: string | null;
  applied_pinch_lever: string | null;
  estimated_duration_padded: number | null;
  due_at: string | null;
  captured_at: string;
  subtasks: Subtask[];
};
export type Insights = {
  completion_rate: number | null;
  days_active_this_week: number;
  days_active_total: number;
  xp: number;
  level: number;
  xp_today: number;
  xp_daily_cap: number;
  energy_by_day: Record<string, number>;
  hyperfocus_sessions_14d: number;
  hyperfocus_peak_hour: number | null;
  hyperfocus_top_category: string | null;
  crisis_sprints_14d: number;
  crisis_overuse: boolean;
};
export type Idea = { id: string; text: string; created_at: string; promoted_task_id: string | null };
export type Preferences = { calm_mode: boolean; dyslexia_font: boolean; reminder_offsets: number[] };
export type Me = { id: string; onboarded: boolean; disclaimer: string; preferences: Preferences };

