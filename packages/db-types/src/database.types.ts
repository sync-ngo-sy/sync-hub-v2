export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      access_requests: {
        Row: {
          company: string;
          created_at: string;
          decided_at: string | null;
          email: string;
          full_name: string;
          id: string;
          status: Database['public']['Enums']['access_request_status'];
          tenant_id: string | null;
        };
        Insert: {
          company: string;
          created_at?: string;
          decided_at?: string | null;
          email: string;
          full_name: string;
          id?: string;
          status?: Database['public']['Enums']['access_request_status'];
          tenant_id?: string | null;
        };
        Update: {
          company?: string;
          created_at?: string;
          decided_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          status?: Database['public']['Enums']['access_request_status'];
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'access_requests_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      application_ai_match_assessments: {
        Row: {
          application_id: string;
          assessment_details: Json | null;
          created_at: string;
          explanation: string | null;
          id: string;
          match_percentage: number;
          model_name: string;
          prompt_version: string;
        };
        Insert: {
          application_id: string;
          assessment_details?: Json | null;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          match_percentage: number;
          model_name: string;
          prompt_version: string;
        };
        Update: {
          application_id?: string;
          assessment_details?: Json | null;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          match_percentage?: number;
          model_name?: string;
          prompt_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'application_ai_match_assessments_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
        ];
      };
      application_answers: {
        Row: {
          answer_boolean: boolean | null;
          answer_text: string | null;
          application_id: string;
          created_at: string;
          job_id: string;
          question_id: string;
        };
        Insert: {
          answer_boolean?: boolean | null;
          answer_text?: string | null;
          application_id: string;
          created_at?: string;
          job_id: string;
          question_id: string;
        };
        Update: {
          answer_boolean?: boolean | null;
          answer_text?: string | null;
          application_id?: string;
          created_at?: string;
          job_id?: string;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'application_answers_job_id_application_id_fkey';
            columns: ['job_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['job_id', 'id'];
          },
          {
            foreignKeyName: 'application_answers_job_id_question_id_fkey';
            columns: ['job_id', 'question_id'];
            isOneToOne: false;
            referencedRelation: 'job_application_questions';
            referencedColumns: ['job_id', 'id'];
          },
        ];
      };
      application_educations: {
        Row: {
          application_id: string;
          degree: string | null;
          description: string | null;
          field_of_study: string | null;
          graduation_year: number | null;
          id: string;
          institution: string;
          sort_order: number;
        };
        Insert: {
          application_id: string;
          degree?: string | null;
          description?: string | null;
          field_of_study?: string | null;
          graduation_year?: number | null;
          id?: string;
          institution: string;
          sort_order?: number;
        };
        Update: {
          application_id?: string;
          degree?: string | null;
          description?: string | null;
          field_of_study?: string | null;
          graduation_year?: number | null;
          id?: string;
          institution?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'application_educations_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
        ];
      };
      application_experiences: {
        Row: {
          application_id: string;
          company_name: string | null;
          description: string | null;
          end_month: number | null;
          end_year: number | null;
          id: string;
          is_current: boolean;
          job_title: string;
          sort_order: number;
          start_month: number | null;
          start_year: number;
        };
        Insert: {
          application_id: string;
          company_name?: string | null;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          job_title: string;
          sort_order?: number;
          start_month?: number | null;
          start_year: number;
        };
        Update: {
          application_id?: string;
          company_name?: string | null;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          job_title?: string;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'application_experiences_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
        ];
      };
      application_languages: {
        Row: {
          application_id: string;
          language_code: string;
          proficiency: Database['public']['Enums']['language_proficiency'];
          sort_order: number;
        };
        Insert: {
          application_id: string;
          language_code: string;
          proficiency: Database['public']['Enums']['language_proficiency'];
          sort_order?: number;
        };
        Update: {
          application_id?: string;
          language_code?: string;
          proficiency?: Database['public']['Enums']['language_proficiency'];
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'application_languages_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'application_languages_language_code_fkey';
            columns: ['language_code'];
            isOneToOne: false;
            referencedRelation: 'languages';
            referencedColumns: ['code'];
          },
        ];
      };
      application_profile_snapshots: {
        Row: {
          application_id: string;
          canonical_role: string | null;
          captured_at: string;
          full_name: string;
          github_url: string | null;
          headline: string | null;
          linkedin_url: string | null;
          location: string | null;
          phone: string | null;
          phone_country: string | null;
          portfolio_url: string | null;
          summary: string | null;
          total_experience_years: number;
          unmapped_skills: string[];
        };
        Insert: {
          application_id: string;
          canonical_role?: string | null;
          captured_at?: string;
          full_name: string;
          github_url?: string | null;
          headline?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          phone?: string | null;
          phone_country?: string | null;
          portfolio_url?: string | null;
          summary?: string | null;
          total_experience_years: number;
          unmapped_skills?: string[];
        };
        Update: {
          application_id?: string;
          canonical_role?: string | null;
          captured_at?: string;
          full_name?: string;
          github_url?: string | null;
          headline?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          phone?: string | null;
          phone_country?: string | null;
          portfolio_url?: string | null;
          summary?: string | null;
          total_experience_years?: number;
          unmapped_skills?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'application_profile_snapshots_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: true;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
        ];
      };
      application_projects: {
        Row: {
          application_id: string;
          description: string | null;
          end_month: number | null;
          end_year: number | null;
          id: string;
          name: string;
          project_url: string | null;
          repository_url: string | null;
          sort_order: number;
          start_month: number | null;
          start_year: number | null;
        };
        Insert: {
          application_id: string;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          name: string;
          project_url?: string | null;
          repository_url?: string | null;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
        };
        Update: {
          application_id?: string;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          name?: string;
          project_url?: string | null;
          repository_url?: string | null;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'application_projects_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
        ];
      };
      application_qualification_history: {
        Row: {
          application_id: string;
          created_at: string;
          id: string;
          qualification_reason: string | null;
          qualification_status: Database['public']['Enums']['qualification_status'];
          screening_version: string | null;
        };
        Insert: {
          application_id: string;
          created_at?: string;
          id?: string;
          qualification_reason?: string | null;
          qualification_status: Database['public']['Enums']['qualification_status'];
          screening_version?: string | null;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          id?: string;
          qualification_reason?: string | null;
          qualification_status?: Database['public']['Enums']['qualification_status'];
          screening_version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'application_qualification_history_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
        ];
      };
      application_skills: {
        Row: {
          application_id: string;
          sort_order: number;
          taxonomy_id: string;
          years_experience: number;
        };
        Insert: {
          application_id: string;
          sort_order?: number;
          taxonomy_id: string;
          years_experience: number;
        };
        Update: {
          application_id?: string;
          sort_order?: number;
          taxonomy_id?: string;
          years_experience?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'application_skills_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'application_skills_taxonomy_id_fkey';
            columns: ['taxonomy_id'];
            isOneToOne: false;
            referencedRelation: 'skill_taxonomy';
            referencedColumns: ['id'];
          },
        ];
      };
      application_status_history: {
        Row: {
          application_id: string;
          change_source: Database['public']['Enums']['status_change_source'];
          changed_by_profile_id: string | null;
          created_at: string;
          id: string;
          new_status: Database['public']['Enums']['application_status'];
          previous_status: Database['public']['Enums']['application_status'] | null;
          reason: string | null;
        };
        Insert: {
          application_id: string;
          change_source: Database['public']['Enums']['status_change_source'];
          changed_by_profile_id?: string | null;
          created_at?: string;
          id?: string;
          new_status: Database['public']['Enums']['application_status'];
          previous_status?: Database['public']['Enums']['application_status'] | null;
          reason?: string | null;
        };
        Update: {
          application_id?: string;
          change_source?: Database['public']['Enums']['status_change_source'];
          changed_by_profile_id?: string | null;
          created_at?: string;
          id?: string;
          new_status?: Database['public']['Enums']['application_status'];
          previous_status?: Database['public']['Enums']['application_status'] | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'application_status_history_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'application_status_history_changed_by_profile_id_fkey';
            columns: ['changed_by_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      application_tag_assignments: {
        Row: {
          added_by_recruiter_id: string;
          application_id: string;
          created_at: string;
          scope: Database['public']['Enums']['tag_scope'];
          tag_id: string;
          tenant_id: string;
        };
        Insert: {
          added_by_recruiter_id: string;
          application_id: string;
          created_at?: string;
          scope?: Database['public']['Enums']['tag_scope'];
          tag_id: string;
          tenant_id: string;
        };
        Update: {
          added_by_recruiter_id?: string;
          application_id?: string;
          created_at?: string;
          scope?: Database['public']['Enums']['tag_scope'];
          tag_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'application_tag_assignments_tag_id_scope_fkey';
            columns: ['tag_id', 'scope'];
            isOneToOne: false;
            referencedRelation: 'tenant_tags';
            referencedColumns: ['id', 'scope'];
          },
          {
            foreignKeyName: 'application_tag_assignments_tenant_id_added_by_recruiter_i_fkey';
            columns: ['tenant_id', 'added_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'application_tag_assignments_tenant_id_application_id_fkey';
            columns: ['tenant_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'application_tag_assignments_tenant_id_tag_id_fkey';
            columns: ['tenant_id', 'tag_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_tags';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
      applications: {
        Row: {
          applied_at: string;
          candidate_id: string;
          current_match_assessment_id: string | null;
          current_match_score: number | null;
          cv_id: string;
          id: string;
          job_id: string;
          qualification_reason: string | null;
          qualification_status: Database['public']['Enums']['qualification_status'];
          status: Database['public']['Enums']['application_status'];
          tenant_id: string;
          tracked_link_id: string | null;
          updated_at: string;
        };
        Insert: {
          applied_at?: string;
          candidate_id: string;
          current_match_assessment_id?: string | null;
          current_match_score?: number | null;
          cv_id: string;
          id?: string;
          job_id: string;
          qualification_reason?: string | null;
          qualification_status?: Database['public']['Enums']['qualification_status'];
          status?: Database['public']['Enums']['application_status'];
          tenant_id: string;
          tracked_link_id?: string | null;
          updated_at?: string;
        };
        Update: {
          applied_at?: string;
          candidate_id?: string;
          current_match_assessment_id?: string | null;
          current_match_score?: number | null;
          cv_id?: string;
          id?: string;
          job_id?: string;
          qualification_reason?: string | null;
          qualification_status?: Database['public']['Enums']['qualification_status'];
          status?: Database['public']['Enums']['application_status'];
          tenant_id?: string;
          tracked_link_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'applications_candidate_id_cv_id_fkey';
            columns: ['candidate_id', 'cv_id'];
            isOneToOne: false;
            referencedRelation: 'cvs';
            referencedColumns: ['candidate_id', 'id'];
          },
          {
            foreignKeyName: 'applications_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'applications_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'applications_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_current_match_assessment_fk';
            columns: ['id', 'current_match_assessment_id'];
            isOneToOne: false;
            referencedRelation: 'application_ai_match_assessments';
            referencedColumns: ['application_id', 'id'];
          },
          {
            foreignKeyName: 'applications_tenant_id_job_id_fkey';
            columns: ['tenant_id', 'job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'applications_tracked_link_fk';
            columns: ['job_id', 'tracked_link_id'];
            isOneToOne: false;
            referencedRelation: 'tracked_job_links';
            referencedColumns: ['job_id', 'id'];
          },
        ];
      };
      candidate_educations: {
        Row: {
          candidate_id: string;
          created_at: string;
          degree: string | null;
          description: string | null;
          field_of_study: string | null;
          graduation_year: number | null;
          id: string;
          institution: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          degree?: string | null;
          description?: string | null;
          field_of_study?: string | null;
          graduation_year?: number | null;
          id?: string;
          institution: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          degree?: string | null;
          description?: string | null;
          field_of_study?: string | null;
          graduation_year?: number | null;
          id?: string;
          institution?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'candidate_educations_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_educations_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_educations_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
        ];
      };
      candidate_embedding_jobs: {
        Row: {
          attempts: number;
          candidate_id: string;
          claimed_at: string | null;
          dirty: boolean;
          error_message: string | null;
          revision: number;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          candidate_id: string;
          claimed_at?: string | null;
          dirty?: boolean;
          error_message?: string | null;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          candidate_id?: string;
          claimed_at?: string | null;
          dirty?: boolean;
          error_message?: string | null;
          revision?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'candidate_embedding_jobs_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: true;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_embedding_jobs_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: true;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_embedding_jobs_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: true;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
        ];
      };
      candidate_experiences: {
        Row: {
          candidate_id: string;
          company_name: string | null;
          created_at: string;
          description: string | null;
          end_month: number | null;
          end_year: number | null;
          id: string;
          is_current: boolean;
          job_title: string;
          sort_order: number;
          start_month: number | null;
          start_year: number;
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          company_name?: string | null;
          created_at?: string;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          job_title: string;
          sort_order?: number;
          start_month?: number | null;
          start_year: number;
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          company_name?: string | null;
          created_at?: string;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          job_title?: string;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'candidate_experiences_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_experiences_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_experiences_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
        ];
      };
      candidate_languages: {
        Row: {
          candidate_id: string;
          created_at: string;
          language_code: string;
          proficiency: Database['public']['Enums']['language_proficiency'];
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          language_code: string;
          proficiency: Database['public']['Enums']['language_proficiency'];
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          language_code?: string;
          proficiency?: Database['public']['Enums']['language_proficiency'];
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'candidate_languages_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_languages_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_languages_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'candidate_languages_language_code_fkey';
            columns: ['language_code'];
            isOneToOne: false;
            referencedRelation: 'languages';
            referencedColumns: ['code'];
          },
        ];
      };
      candidate_profile_chunks: {
        Row: {
          candidate_id: string;
          chunk_index: number;
          chunk_text: string;
          chunk_type: string | null;
          created_at: string;
          embedding: string;
          embedding_model: string;
          id: string;
          search_vector: unknown;
        };
        Insert: {
          candidate_id: string;
          chunk_index: number;
          chunk_text: string;
          chunk_type?: string | null;
          created_at?: string;
          embedding: string;
          embedding_model: string;
          id?: string;
          search_vector?: unknown;
        };
        Update: {
          candidate_id?: string;
          chunk_index?: number;
          chunk_text?: string;
          chunk_type?: string | null;
          created_at?: string;
          embedding?: string;
          embedding_model?: string;
          id?: string;
          search_vector?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: 'candidate_profile_chunks_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_profile_chunks_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_profile_chunks_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'candidate_profile_chunks_embedding_model_fkey';
            columns: ['embedding_model'];
            isOneToOne: false;
            referencedRelation: 'embedding_models';
            referencedColumns: ['model'];
          },
        ];
      };
      candidate_projects: {
        Row: {
          candidate_id: string;
          created_at: string;
          description: string | null;
          end_month: number | null;
          end_year: number | null;
          id: string;
          name: string;
          project_url: string | null;
          repository_url: string | null;
          sort_order: number;
          start_month: number | null;
          start_year: number | null;
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          name: string;
          project_url?: string | null;
          repository_url?: string | null;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          name?: string;
          project_url?: string | null;
          repository_url?: string | null;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'candidate_projects_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_projects_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_projects_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
        ];
      };
      candidate_skills: {
        Row: {
          candidate_id: string;
          created_at: string;
          sort_order: number;
          taxonomy_id: string;
          updated_at: string;
          years_experience: number;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          sort_order?: number;
          taxonomy_id: string;
          updated_at?: string;
          years_experience: number;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          sort_order?: number;
          taxonomy_id?: string;
          updated_at?: string;
          years_experience?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'candidate_skills_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_skills_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_skills_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'candidate_skills_taxonomy_id_fkey';
            columns: ['taxonomy_id'];
            isOneToOne: false;
            referencedRelation: 'skill_taxonomy';
            referencedColumns: ['id'];
          },
        ];
      };
      candidate_tag_assignments: {
        Row: {
          added_by_recruiter_id: string;
          candidate_id: string;
          created_at: string;
          scope: Database['public']['Enums']['tag_scope'];
          tag_id: string;
          tenant_id: string;
        };
        Insert: {
          added_by_recruiter_id: string;
          candidate_id: string;
          created_at?: string;
          scope?: Database['public']['Enums']['tag_scope'];
          tag_id: string;
          tenant_id: string;
        };
        Update: {
          added_by_recruiter_id?: string;
          candidate_id?: string;
          created_at?: string;
          scope?: Database['public']['Enums']['tag_scope'];
          tag_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'candidate_tag_assignments_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_tag_assignments_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'candidate_tag_assignments_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'candidate_tag_assignments_tag_id_scope_fkey';
            columns: ['tag_id', 'scope'];
            isOneToOne: false;
            referencedRelation: 'tenant_tags';
            referencedColumns: ['id', 'scope'];
          },
          {
            foreignKeyName: 'candidate_tag_assignments_tenant_id_added_by_recruiter_id_fkey';
            columns: ['tenant_id', 'added_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'candidate_tag_assignments_tenant_id_tag_id_fkey';
            columns: ['tenant_id', 'tag_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_tags';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
      candidates: {
        Row: {
          account_type: Database['public']['Enums']['account_type'];
          canonical_role_key: string | null;
          created_at: string;
          current_cv_id: string | null;
          deleted_at: string | null;
          github_url: string | null;
          headline: string | null;
          id: string;
          is_searchable: boolean;
          linkedin_url: string | null;
          location_key: string | null;
          portfolio_url: string | null;
          profile_completed_at: string | null;
          summary: string | null;
          total_experience_years: number;
          unmapped_skills: string[];
          updated_at: string;
        };
        Insert: {
          account_type?: Database['public']['Enums']['account_type'];
          canonical_role_key?: string | null;
          created_at?: string;
          current_cv_id?: string | null;
          deleted_at?: string | null;
          github_url?: string | null;
          headline?: string | null;
          id: string;
          is_searchable?: boolean;
          linkedin_url?: string | null;
          location_key?: string | null;
          portfolio_url?: string | null;
          profile_completed_at?: string | null;
          summary?: string | null;
          total_experience_years?: number;
          unmapped_skills?: string[];
          updated_at?: string;
        };
        Update: {
          account_type?: Database['public']['Enums']['account_type'];
          canonical_role_key?: string | null;
          created_at?: string;
          current_cv_id?: string | null;
          deleted_at?: string | null;
          github_url?: string | null;
          headline?: string | null;
          id?: string;
          is_searchable?: boolean;
          linkedin_url?: string | null;
          location_key?: string | null;
          portfolio_url?: string | null;
          profile_completed_at?: string | null;
          summary?: string | null;
          total_experience_years?: number;
          unmapped_skills?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'candidates_canonical_role_fk';
            columns: ['canonical_role_key'];
            isOneToOne: false;
            referencedRelation: 'canonical_roles';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'candidates_current_cv_fk';
            columns: ['id', 'current_cv_id'];
            isOneToOne: false;
            referencedRelation: 'cvs';
            referencedColumns: ['candidate_id', 'id'];
          },
          {
            foreignKeyName: 'candidates_id_account_type_fkey';
            columns: ['id', 'account_type'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'account_type'];
          },
          {
            foreignKeyName: 'candidates_location_fk';
            columns: ['location_key'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['key'];
          },
        ];
      };
      canonical_roles: {
        Row: {
          key: string;
          name: string;
        };
        Insert: {
          key: string;
          name: string;
        };
        Update: {
          key?: string;
          name?: string;
        };
        Relationships: [];
      };
      communications: {
        Row: {
          application_id: string | null;
          attempts: number;
          available_at: string | null;
          candidate_id: string;
          channel: Database['public']['Enums']['communication_channel'];
          communication_type: Database['public']['Enums']['communication_type'];
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          idempotency_key: string;
          initiated_by_recruiter_id: string | null;
          payload: Json;
          provider: string | null;
          provider_message_id: string | null;
          recipient: string;
          sent_at: string | null;
          started_at: string | null;
          status: Database['public']['Enums']['communication_status'];
          subject: string | null;
          template_key: string | null;
          tenant_id: string | null;
        };
        Insert: {
          application_id?: string | null;
          attempts?: number;
          available_at?: string | null;
          candidate_id: string;
          channel: Database['public']['Enums']['communication_channel'];
          communication_type: Database['public']['Enums']['communication_type'];
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          idempotency_key: string;
          initiated_by_recruiter_id?: string | null;
          payload: Json;
          provider?: string | null;
          provider_message_id?: string | null;
          recipient: string;
          sent_at?: string | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['communication_status'];
          subject?: string | null;
          template_key?: string | null;
          tenant_id?: string | null;
        };
        Update: {
          application_id?: string | null;
          attempts?: number;
          available_at?: string | null;
          candidate_id?: string;
          channel?: Database['public']['Enums']['communication_channel'];
          communication_type?: Database['public']['Enums']['communication_type'];
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          idempotency_key?: string;
          initiated_by_recruiter_id?: string | null;
          payload?: Json;
          provider?: string | null;
          provider_message_id?: string | null;
          recipient?: string;
          sent_at?: string | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['communication_status'];
          subject?: string | null;
          template_key?: string | null;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'communications_application_id_candidate_id_fkey';
            columns: ['application_id', 'candidate_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id', 'candidate_id'];
          },
          {
            foreignKeyName: 'communications_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'communications_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'communications_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'communications_tenant_id_application_id_fkey';
            columns: ['tenant_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'communications_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'communications_tenant_id_initiated_by_recruiter_id_fkey';
            columns: ['tenant_id', 'initiated_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
      cvs: {
        Row: {
          candidate_id: string;
          created_at: string;
          deleted_at: string | null;
          detected_language: string | null;
          display_name: string;
          file_hash: string;
          id: string;
          parsed_at: string | null;
          parsed_cv_data: Json | null;
          parsed_cv_schema_version: number;
          parsing_error: string | null;
          parsing_status: Database['public']['Enums']['cv_parsing_status'];
          storage_path: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          deleted_at?: string | null;
          detected_language?: string | null;
          display_name: string;
          file_hash: string;
          id?: string;
          parsed_at?: string | null;
          parsed_cv_data?: Json | null;
          parsed_cv_schema_version?: number;
          parsing_error?: string | null;
          parsing_status?: Database['public']['Enums']['cv_parsing_status'];
          storage_path: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          detected_language?: string | null;
          display_name?: string;
          file_hash?: string;
          id?: string;
          parsed_at?: string | null;
          parsed_cv_data?: Json | null;
          parsed_cv_schema_version?: number;
          parsing_error?: string | null;
          parsing_status?: Database['public']['Enums']['cv_parsing_status'];
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cvs_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'cvs_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'cvs_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cvs_detected_language_fk';
            columns: ['detected_language'];
            isOneToOne: false;
            referencedRelation: 'languages';
            referencedColumns: ['code'];
          },
        ];
      };
      embedding_models: {
        Row: {
          established_at: string;
          model: string;
        };
        Insert: {
          established_at?: string;
          model: string;
        };
        Update: {
          established_at?: string;
          model?: string;
        };
        Relationships: [];
      };
      hire_claims: {
        Row: {
          answered_at: string | null;
          application_id: string;
          claimed_at: string;
          claimed_by_recruiter_id: string;
          confirmation: Database['public']['Enums']['hire_confirmation'];
          start_date: string;
          status_history_id: string;
          tenant_id: string;
        };
        Insert: {
          answered_at?: string | null;
          application_id: string;
          claimed_at?: string;
          claimed_by_recruiter_id: string;
          confirmation?: Database['public']['Enums']['hire_confirmation'];
          start_date: string;
          status_history_id: string;
          tenant_id: string;
        };
        Update: {
          answered_at?: string | null;
          application_id?: string;
          claimed_at?: string;
          claimed_by_recruiter_id?: string;
          confirmation?: Database['public']['Enums']['hire_confirmation'];
          start_date?: string;
          status_history_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hire_claims_status_history_id_fkey';
            columns: ['status_history_id'];
            isOneToOne: false;
            referencedRelation: 'application_status_history';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hire_claims_tenant_id_application_id_fkey';
            columns: ['tenant_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'hire_claims_tenant_id_claimed_by_recruiter_id_fkey';
            columns: ['tenant_id', 'claimed_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
      ingestion_jobs: {
        Row: {
          attempts: number;
          available_at: string | null;
          completed_at: string | null;
          created_at: string;
          cv_id: string;
          error_message: string | null;
          id: string;
          started_at: string | null;
          status: Database['public']['Enums']['ingestion_status'];
        };
        Insert: {
          attempts?: number;
          available_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          cv_id: string;
          error_message?: string | null;
          id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['ingestion_status'];
        };
        Update: {
          attempts?: number;
          available_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          cv_id?: string;
          error_message?: string | null;
          id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['ingestion_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'ingestion_jobs_cv_id_fkey';
            columns: ['cv_id'];
            isOneToOne: true;
            referencedRelation: 'cvs';
            referencedColumns: ['id'];
          },
        ];
      };
      job_application_questions: {
        Row: {
          accepted_boolean_answer: boolean | null;
          created_at: string;
          id: string;
          is_required: boolean;
          job_id: string;
          question_text: string;
          question_type: Database['public']['Enums']['application_question_type'];
          sort_order: number;
        };
        Insert: {
          accepted_boolean_answer?: boolean | null;
          created_at?: string;
          id?: string;
          is_required?: boolean;
          job_id: string;
          question_text: string;
          question_type: Database['public']['Enums']['application_question_type'];
          sort_order?: number;
        };
        Update: {
          accepted_boolean_answer?: boolean | null;
          created_at?: string;
          id?: string;
          is_required?: boolean;
          job_id?: string;
          question_text?: string;
          question_type?: Database['public']['Enums']['application_question_type'];
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'job_application_questions_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      job_languages: {
        Row: {
          job_id: string;
          language_code: string;
          minimum_proficiency: Database['public']['Enums']['language_proficiency'];
        };
        Insert: {
          job_id: string;
          language_code: string;
          minimum_proficiency: Database['public']['Enums']['language_proficiency'];
        };
        Update: {
          job_id?: string;
          language_code?: string;
          minimum_proficiency?: Database['public']['Enums']['language_proficiency'];
        };
        Relationships: [
          {
            foreignKeyName: 'job_languages_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_languages_language_code_fkey';
            columns: ['language_code'];
            isOneToOne: false;
            referencedRelation: 'languages';
            referencedColumns: ['code'];
          },
        ];
      };
      job_skills: {
        Row: {
          created_at: string;
          id: string;
          importance: Database['public']['Enums']['skill_importance'];
          job_id: string;
          minimum_years: number | null;
          taxonomy_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          importance?: Database['public']['Enums']['skill_importance'];
          job_id: string;
          minimum_years?: number | null;
          taxonomy_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          importance?: Database['public']['Enums']['skill_importance'];
          job_id?: string;
          minimum_years?: number | null;
          taxonomy_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_skills_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_skills_taxonomy_id_fkey';
            columns: ['taxonomy_id'];
            isOneToOne: false;
            referencedRelation: 'skill_taxonomy';
            referencedColumns: ['id'];
          },
        ];
      };
      job_view_events: {
        Row: {
          id: number;
          job_id: string;
          session_id: string | null;
          tracked_link_id: string | null;
          viewed_at: string;
          visitor_hash: string | null;
        };
        Insert: {
          id?: never;
          job_id: string;
          session_id?: string | null;
          tracked_link_id?: string | null;
          viewed_at?: string;
          visitor_hash?: string | null;
        };
        Update: {
          id?: never;
          job_id?: string;
          session_id?: string | null;
          tracked_link_id?: string | null;
          viewed_at?: string;
          visitor_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'job_view_events_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_view_events_job_id_tracked_link_id_fkey';
            columns: ['job_id', 'tracked_link_id'];
            isOneToOne: false;
            referencedRelation: 'tracked_job_links';
            referencedColumns: ['job_id', 'id'];
          },
        ];
      };
      jobs: {
        Row: {
          created_at: string;
          created_by_recruiter_id: string;
          description: string;
          employment_type: Database['public']['Enums']['employment_type'] | null;
          expires_at: string | null;
          id: string;
          location_key: string | null;
          minimum_total_experience_years: number | null;
          published_at: string | null;
          search_vector: unknown;
          status: Database['public']['Enums']['job_status'];
          tenant_id: string;
          title: string;
          updated_at: string;
          work_mode: Database['public']['Enums']['work_mode'] | null;
        };
        Insert: {
          created_at?: string;
          created_by_recruiter_id: string;
          description: string;
          employment_type?: Database['public']['Enums']['employment_type'] | null;
          expires_at?: string | null;
          id?: string;
          location_key?: string | null;
          minimum_total_experience_years?: number | null;
          published_at?: string | null;
          search_vector?: unknown;
          status?: Database['public']['Enums']['job_status'];
          tenant_id: string;
          title: string;
          updated_at?: string;
          work_mode?: Database['public']['Enums']['work_mode'] | null;
        };
        Update: {
          created_at?: string;
          created_by_recruiter_id?: string;
          description?: string;
          employment_type?: Database['public']['Enums']['employment_type'] | null;
          expires_at?: string | null;
          id?: string;
          location_key?: string | null;
          minimum_total_experience_years?: number | null;
          published_at?: string | null;
          search_vector?: unknown;
          status?: Database['public']['Enums']['job_status'];
          tenant_id?: string;
          title?: string;
          updated_at?: string;
          work_mode?: Database['public']['Enums']['work_mode'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_location_key_fkey';
            columns: ['location_key'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'jobs_tenant_id_created_by_recruiter_id_fkey';
            columns: ['tenant_id', 'created_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'jobs_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      languages: {
        Row: {
          code: string;
          name: string;
        };
        Insert: {
          code: string;
          name: string;
        };
        Update: {
          code?: string;
          name?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          key: string;
          kind: Database['public']['Enums']['location_kind'];
          name: string;
        };
        Insert: {
          key: string;
          kind: Database['public']['Enums']['location_kind'];
          name: string;
        };
        Update: {
          key?: string;
          kind?: Database['public']['Enums']['location_kind'];
          name?: string;
        };
        Relationships: [];
      };
      match_assessment_jobs: {
        Row: {
          application_id: string;
          attempts: number;
          available_at: string | null;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          started_at: string | null;
          status: Database['public']['Enums']['assessment_status'];
        };
        Insert: {
          application_id: string;
          attempts?: number;
          available_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['assessment_status'];
        };
        Update: {
          application_id?: string;
          attempts?: number;
          available_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['assessment_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'match_assessment_jobs_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: true;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
        ];
      };
      message_templates: {
        Row: {
          body: string;
          created_at: string;
          created_by_recruiter_id: string;
          id: string;
          name: string;
          subject: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by_recruiter_id: string;
          id?: string;
          name: string;
          subject: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by_recruiter_id?: string;
          id?: string;
          name?: string;
          subject?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_templates_tenant_id_created_by_recruiter_id_fkey';
            columns: ['tenant_id', 'created_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'message_templates_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      notes: {
        Row: {
          application_id: string | null;
          candidate_id: string | null;
          created_at: string;
          id: string;
          note_text: string;
          recruiter_id: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          application_id?: string | null;
          candidate_id?: string | null;
          created_at?: string;
          id?: string;
          note_text: string;
          recruiter_id: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          application_id?: string | null;
          candidate_id?: string | null;
          created_at?: string;
          id?: string;
          note_text?: string;
          recruiter_id?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'notes_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'notes_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_tenant_id_application_id_fkey';
            columns: ['tenant_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'notes_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notes_tenant_id_recruiter_id_fkey';
            columns: ['tenant_id', 'recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
      notifications: {
        Row: {
          application_id: string | null;
          created_at: string;
          id: string;
          payload: Json;
          read_at: string | null;
          recipient_profile_id: string;
          type: Database['public']['Enums']['notification_type'];
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          payload: Json;
          read_at?: string | null;
          recipient_profile_id: string;
          type: Database['public']['Enums']['notification_type'];
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          payload?: Json;
          read_at?: string | null;
          recipient_profile_id?: string;
          type?: Database['public']['Enums']['notification_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_application_id_recipient_profile_id_fkey';
            columns: ['application_id', 'recipient_profile_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id', 'candidate_id'];
          },
          {
            foreignKeyName: 'notifications_recipient_profile_id_fkey';
            columns: ['recipient_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_admins: {
        Row: {
          account_type: Database['public']['Enums']['account_type'];
          created_at: string;
          id: string;
        };
        Insert: {
          account_type?: Database['public']['Enums']['account_type'];
          created_at?: string;
          id: string;
        };
        Update: {
          account_type?: Database['public']['Enums']['account_type'];
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_admins_id_account_type_fkey';
            columns: ['id', 'account_type'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'account_type'];
          },
        ];
      };
      profiles: {
        Row: {
          account_type: Database['public']['Enums']['account_type'];
          avatar_url: string | null;
          created_at: string;
          deleted_at: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          phone_country: string | null;
          updated_at: string;
        };
        Insert: {
          account_type: Database['public']['Enums']['account_type'];
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          full_name: string;
          id: string;
          phone?: string | null;
          phone_country?: string | null;
          updated_at?: string;
        };
        Update: {
          account_type?: Database['public']['Enums']['account_type'];
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          phone_country?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      recruiters: {
        Row: {
          account_type: Database['public']['Enums']['account_type'];
          created_at: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['recruiter_role'];
          tenant_id: string;
        };
        Insert: {
          account_type?: Database['public']['Enums']['account_type'];
          created_at?: string;
          id: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['recruiter_role'];
          tenant_id: string;
        };
        Update: {
          account_type?: Database['public']['Enums']['account_type'];
          created_at?: string;
          id?: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['recruiter_role'];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recruiters_id_account_type_fkey';
            columns: ['id', 'account_type'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id', 'account_type'];
          },
          {
            foreignKeyName: 'recruiters_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      skill_categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      skill_taxonomy: {
        Row: {
          canonical_name: string;
          category_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          canonical_name: string;
          category_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          canonical_name?: string;
          category_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'skill_taxonomy_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'skill_categories';
            referencedColumns: ['id'];
          },
        ];
      };
      talent_pool_members: {
        Row: {
          added_at: string;
          added_by_recruiter_id: string;
          candidate_id: string;
          tenant_id: string;
        };
        Insert: {
          added_at?: string;
          added_by_recruiter_id: string;
          candidate_id: string;
          tenant_id: string;
        };
        Update: {
          added_at?: string;
          added_by_recruiter_id?: string;
          candidate_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'talent_pool_members_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_directory_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'talent_pool_members_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidate_search_profiles';
            referencedColumns: ['candidate_id'];
          },
          {
            foreignKeyName: 'talent_pool_members_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'talent_pool_members_tenant_id_added_by_recruiter_id_fkey';
            columns: ['tenant_id', 'added_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'talent_pool_members_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          scope: Database['public']['Enums']['tag_scope'];
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          scope: Database['public']['Enums']['tag_scope'];
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          scope?: Database['public']['Enums']['tag_scope'];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_tags_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          plan: Database['public']['Enums']['tenant_plan'];
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          plan?: Database['public']['Enums']['tenant_plan'];
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          plan?: Database['public']['Enums']['tenant_plan'];
          slug?: string;
        };
        Relationships: [];
      };
      tracked_job_links: {
        Row: {
          created_at: string;
          created_by_recruiter_id: string;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          job_id: string;
          name: string;
          tenant_id: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          created_by_recruiter_id: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          job_id: string;
          name: string;
          tenant_id: string;
          token: string;
        };
        Update: {
          created_at?: string;
          created_by_recruiter_id?: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          job_id?: string;
          name?: string;
          tenant_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tracked_job_links_tenant_id_created_by_recruiter_id_fkey';
            columns: ['tenant_id', 'created_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'tracked_job_links_tenant_id_job_id_fkey';
            columns: ['tenant_id', 'job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
    };
    Views: {
      candidate_directory_profiles: {
        Row: {
          avatar_url: string | null;
          candidate_id: string | null;
          canonical_role_key: string | null;
          canonical_role_name: string | null;
          created_at: string | null;
          full_name: string | null;
          headline: string | null;
          language_names: string[] | null;
          location_key: string | null;
          location_name: string | null;
          summary: string | null;
          total_experience_years: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'candidates_canonical_role_fk';
            columns: ['canonical_role_key'];
            isOneToOne: false;
            referencedRelation: 'canonical_roles';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'candidates_location_fk';
            columns: ['location_key'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['key'];
          },
        ];
      };
      candidate_search_profiles: {
        Row: {
          avatar_url: string | null;
          candidate_id: string | null;
          canonical_role_key: string | null;
          canonical_role_name: string | null;
          created_at: string | null;
          full_name: string | null;
          headline: string | null;
          language_names: string[] | null;
          location_key: string | null;
          location_name: string | null;
          summary: string | null;
          total_experience_years: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'candidates_canonical_role_fk';
            columns: ['canonical_role_key'];
            isOneToOne: false;
            referencedRelation: 'canonical_roles';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'candidates_location_fk';
            columns: ['location_key'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['key'];
          },
        ];
      };
      placements: {
        Row: {
          application_id: string | null;
          claimed_at: string | null;
          claimed_by_recruiter_id: string | null;
          confirmed_at: string | null;
          start_date: string | null;
          tenant_id: string | null;
        };
        Insert: {
          application_id?: string | null;
          claimed_at?: string | null;
          claimed_by_recruiter_id?: string | null;
          confirmed_at?: string | null;
          start_date?: string | null;
          tenant_id?: string | null;
        };
        Update: {
          application_id?: string | null;
          claimed_at?: string | null;
          claimed_by_recruiter_id?: string | null;
          confirmed_at?: string | null;
          start_date?: string | null;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hire_claims_tenant_id_application_id_fkey';
            columns: ['tenant_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['tenant_id', 'id'];
          },
          {
            foreignKeyName: 'hire_claims_tenant_id_claimed_by_recruiter_id_fkey';
            columns: ['tenant_id', 'claimed_by_recruiter_id'];
            isOneToOne: false;
            referencedRelation: 'recruiters';
            referencedColumns: ['tenant_id', 'id'];
          },
        ];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      access_request_status: 'pending' | 'converted' | 'dismissed';
      account_type: 'candidate' | 'recruiter' | 'platform_admin';
      application_question_type: 'yes_no' | 'short_text';
      application_status:
        | 'new'
        | 'reviewing'
        | 'shortlisted'
        | 'interview'
        | 'offer'
        | 'hired'
        | 'rejected'
        | 'withdrawn';
      assessment_status: 'pending' | 'processing' | 'completed' | 'failed';
      communication_channel: 'email' | 'sms';
      communication_status: 'queued' | 'processing' | 'sent' | 'failed';
      communication_type:
        | 'application_confirmation'
        | 'application_rejection'
        | 'recruiter_message';
      cv_parsing_status: 'uploaded' | 'processing' | 'ready' | 'failed';
      employment_type:
        | 'full_time'
        | 'part_time'
        | 'contract'
        | 'temporary'
        | 'internship'
        | 'volunteer';
      hire_confirmation: 'unanswered' | 'confirmed' | 'denied';
      ingestion_status: 'pending' | 'processing' | 'completed' | 'failed';
      job_status: 'draft' | 'published' | 'closed' | 'archived';
      language_proficiency: 'beginner' | 'intermediate' | 'advanced' | 'fluent' | 'native';
      location_kind: 'country' | 'governorate';
      notification_type: 'cv_parse_failed' | 'cv_parse_succeeded' | 'application_stage_changed';
      qualification_status: 'pending' | 'qualified' | 'disqualified' | 'review_required';
      recruiter_role: 'admin' | 'recruiter';
      skill_importance: 'required' | 'preferred' | 'optional';
      status_change_source: 'recruiter' | 'candidate' | 'system';
      tag_scope: 'candidate' | 'application';
      tenant_plan: 'free' | 'pro' | 'enterprise';
      work_mode: 'onsite' | 'hybrid' | 'remote';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_request_status: ['pending', 'converted', 'dismissed'],
      account_type: ['candidate', 'recruiter', 'platform_admin'],
      application_question_type: ['yes_no', 'short_text'],
      application_status: [
        'new',
        'reviewing',
        'shortlisted',
        'interview',
        'offer',
        'hired',
        'rejected',
        'withdrawn',
      ],
      assessment_status: ['pending', 'processing', 'completed', 'failed'],
      communication_channel: ['email', 'sms'],
      communication_status: ['queued', 'processing', 'sent', 'failed'],
      communication_type: [
        'application_confirmation',
        'application_rejection',
        'recruiter_message',
      ],
      cv_parsing_status: ['uploaded', 'processing', 'ready', 'failed'],
      employment_type: [
        'full_time',
        'part_time',
        'contract',
        'temporary',
        'internship',
        'volunteer',
      ],
      hire_confirmation: ['unanswered', 'confirmed', 'denied'],
      ingestion_status: ['pending', 'processing', 'completed', 'failed'],
      job_status: ['draft', 'published', 'closed', 'archived'],
      language_proficiency: ['beginner', 'intermediate', 'advanced', 'fluent', 'native'],
      location_kind: ['country', 'governorate'],
      notification_type: ['cv_parse_failed', 'cv_parse_succeeded', 'application_stage_changed'],
      qualification_status: ['pending', 'qualified', 'disqualified', 'review_required'],
      recruiter_role: ['admin', 'recruiter'],
      skill_importance: ['required', 'preferred', 'optional'],
      status_change_source: ['recruiter', 'candidate', 'system'],
      tag_scope: ['candidate', 'application'],
      tenant_plan: ['free', 'pro', 'enterprise'],
      work_mode: ['onsite', 'hybrid', 'remote'],
    },
  },
} as const;
