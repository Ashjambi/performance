






export type TimePeriod = 'monthly' | 'quarterly' | 'yearly';
export type ExecutiveTab = 'overview' | 'matrix' | 'risk_assessment' | 'action_hub';

export type WhatIfAnalysis = {
    simulation_summary: string;
    overall_score_impact: {
        from: number;
        to: number;
    };
    related_kpis_impact: {
        kpi_name: string;
        impact_description: string;
    }[];
    recommendations: string[];
};


export type Comment = {
    id: string;
    author: string; // For simplicity, just a name. Could be a user ID.
    text: string;
    createdAt: string; // ISO String
};


export type Recommendation = {
    text: string;
    targetRole: ManagerRole;
};

export type ActionStep = {
    id: string;
    text: string;
    isCompleted: boolean;
    assignedTo?: string;
    dueDate?: string; // ISO String
};

export type ActionPlan = {
    id:string;
    originalRecommendation: string;
    steps: ActionStep[];
    createdAt: string; // ISO string
    comments: Comment[];
};


export type KPIHistory = {
  date: string; // ISO string
  value: number;
};

export type KPI = {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: 'percentage' | 'minutes' | 'per_1000_pax' | 'incidents' | 'score' | 'currency' | 'days' | 'per_1000_mov';
  lowerIsBetter: boolean;
  tooltip: {
    description: string;
    dataSource: string;
    importance: string;
  };
  history: KPIHistory[];
  benchmark?: {
    target: number;
    source: string;
  };
};

export type Pillar = {
  id: string;
  name: string;
  weight: number;
  iconName: 'ChartBarIcon' | 'ShieldCheckIcon' | 'BanknotesIcon' | 'UserGroupIcon' | 'HeartIcon' | 'ArchiveBoxIcon';
  kpis: KPI[];
};

export type AnalysisResult = {
  analysis: string;
  recommendations: Recommendation[];
};

// These types are also defined in data.tsx due to the project structure,
// but are kept here for potential modularization in the future.
export const ROLES = {
  RAMP: 'Ramp Operations',
  PASSENGER: 'Passenger Services',
  SUPPORT: 'Business Support',
  SAFETY: 'Safety & Quality',
  TECHNICAL: 'Technical Services',
} as const;

export type ManagerRole = keyof typeof ROLES;

export type Manager = {
  id:string;
  name: string;
  department: string;
  role: ManagerRole;
  pillars: Pillar[];
  actionPlans: ActionPlan[];
};

export type Alert = {
    id: string;
    managerId: string;
    managerName: string;
    kpiName: string;
    kpiScore: number;
    timestamp: string; // ISO String
    isRead: boolean;
};

export type RiskProfile = {
  profile: string;
  reasoning: string;
  risk_level: 'Low' | 'Medium' | 'High';
};

export type ManagerWithData = {
    id: string;
    name: string;
    score: number;
    riskProfile: RiskProfile | null;
};