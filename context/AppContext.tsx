import React, { createContext, useReducer, useEffect } from 'react';
import { INITIAL_MANAGERS_DATA, ROLE_TEMPLATES, deepCopy, calculateKpiScore } from '../data.tsx';
import type { Manager, ManagerRole, ActionPlan, Comment, Alert, TimePeriod, RegisteredRisk, RiskStatus, IdentifiedRisk } from '../data.tsx';

// --- STATE AND ACTION TYPES ---

type State = {
  managers: Manager[];
  selectedManagerId: string | null;
  currentView: 'manager' | 'executive';
  alerts: Alert[];
  currentTimePeriod: TimePeriod;
  riskRegister: RegisteredRisk[];
};

type Action =
  | { type: 'SET_STATE'; payload: State }
  | { type: 'SET_VIEW'; payload: 'manager' | 'executive' }
  | { type: 'SET_SELECTED_MANAGER'; payload: string }
  | { type: 'ADD_MANAGER'; payload: { name: string; department: string; role: ManagerRole } }
  | { type: 'UPDATE_MANAGER'; payload: Manager }
  | { type: 'DELETE_MANAGER'; payload: string }
  | { type: 'UPDATE_KPI'; payload: { pillarId: string; kpiId: string; value: number } }
  | { type: 'ADD_ACTION_PLAN'; payload: { managerId: string, recommendation: string; steps: { text: string, days_to_complete: number }[] } }
  | { type: 'ADD_MANUAL_ACTION_PLAN'; payload: { managerId: string, recommendation: string; steps: string[] } }
  | { type: 'TOGGLE_ACTION_PLAN_STEP'; payload: { managerId: string; planId: string; stepId: string } }
  | { type: 'DELETE_ACTION_PLAN'; payload: { managerId: string; planId: string } }
  | { type: 'ADD_ACTION_PLAN_COMMENT'; payload: { managerId: string; planId: string; commentText: string } }
  | { type: 'UPDATE_ACTION_STEP_ASSIGNEE'; payload: { managerId: string; planId: string; stepId: string, assignee: string } }
  | { type: 'UPDATE_KPI_TARGET'; payload: { kpiId: string, newTarget: number } }
  | { type: 'MARK_ALERT_READ'; payload: { alertId?: string, all?: boolean } }
  | { type: 'SET_TIME_PERIOD'; payload: TimePeriod }
  | { type: 'ADD_TO_RISK_REGISTER'; payload: { risk: IdentifiedRisk, source: string } }
  | { type: 'UPDATE_RISK_STATUS'; payload: { riskId: string, newStatus: RiskStatus } };


// --- REDUCER ---

const appReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_STATE':
        return action.payload;
    
    case 'SET_VIEW':
        return { ...state, currentView: action.payload };

    case 'SET_TIME_PERIOD':
        return { ...state, currentTimePeriod: action.payload };

    case 'SET_SELECTED_MANAGER':
      return { ...state, selectedManagerId: action.payload };

    case 'ADD_MANAGER': {
      const { name, role, department } = action.payload;
      const newManager: Manager = {
        id: `manager_${Date.now()}`,
        name,
        department,
        role,
        pillars: deepCopy(ROLE_TEMPLATES[role]),
        actionPlans: [],
      };
      return {
        ...state,
        managers: [...state.managers, newManager],
        selectedManagerId: newManager.id,
      };
    }
    
    case 'UPDATE_MANAGER': {
        const updatedManager = action.payload;
        return {
            ...state,
            managers: state.managers.map(m => m.id === updatedManager.id ? updatedManager : m)
        };
    }

    case 'DELETE_MANAGER': {
      const managerIdToDelete = action.payload;
      const newManagers = state.managers.filter(m => m.id !== managerIdToDelete);
      let newSelectedId = state.selectedManagerId;
      if (state.selectedManagerId === managerIdToDelete) {
        newSelectedId = newManagers.length > 0 ? newManagers[0].id : null;
      }
      return { ...state, managers: newManagers, selectedManagerId: newSelectedId };
    }

    case 'UPDATE_KPI': {
      const { pillarId, kpiId, value } = action.payload;
      return {
        ...state,
        managers: state.managers.map(manager => {
          if (manager.id === state.selectedManagerId) {
            const newPillars = manager.pillars.map(pillar => {
              if (pillar.id === pillarId) {
                const newKpis = pillar.kpis.map(kpi => {
                  if (kpi.id === kpiId) {
                     const newHistoryEntry = { date: new Date().toISOString(), value: value };
                     // Make a copy to avoid mutation issues
                     const updatedHistory = kpi.history ? [...kpi.history] : [];
                     updatedHistory.push(newHistoryEntry);
                     // Optional: Keep history to a certain length, e.g., 12 months
                     if (updatedHistory.length > 12) {
                        updatedHistory.shift();
                     }
                    return { ...kpi, value: value, history: updatedHistory };
                  }
                  return kpi;
                });
                return { ...pillar, kpis: newKpis };
              }
              return pillar;
            });
            return { ...manager, pillars: newPillars };
          }
          return manager;
        })
      };
    }

    case 'ADD_ACTION_PLAN': {
      const { managerId, recommendation, steps } = action.payload;
      const newPlan: ActionPlan = {
        id: `plan_${Date.now()}`,
        originalRecommendation: recommendation,
        createdAt: new Date().toISOString(),
        steps: steps.map((stepData, index) => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (stepData.days_to_complete || 7)); // Default 7 days
            return {
                id: `step_${Date.now()}_${index}`,
                text: stepData.text,
                isCompleted: false,
                dueDate: dueDate.toISOString(),
            };
        }),
        comments: [],
      };
       return {
        ...state,
        managers: state.managers.map(manager => 
            manager.id === managerId 
                ? { ...manager, actionPlans: [newPlan, ...manager.actionPlans] } 
                : manager
        ),
      };
    }
    
    case 'ADD_MANUAL_ACTION_PLAN': {
        const { managerId, recommendation, steps } = action.payload;
        const newPlan: ActionPlan = {
            id: `plan_${Date.now()}`,
            originalRecommendation: recommendation,
            createdAt: new Date().toISOString(),
            steps: steps.map((stepText, index) => ({
                id: `step_${Date.now()}_${index}`,
                text: stepText,
                isCompleted: false,
                 // Manual plans don't have a due date by default
            })),
            comments: [],
        };
        return {
            ...state,
            managers: state.managers.map(manager =>
                manager.id === managerId
                    ? { ...manager, actionPlans: [newPlan, ...manager.actionPlans] }
                    : manager
            ),
        };
    }


    case 'TOGGLE_ACTION_PLAN_STEP': {
        const { managerId, planId, stepId } = action.payload;
        return {
            ...state,
            managers: state.managers.map(manager => {
                if (manager.id === managerId) {
                    const newActionPlans = manager.actionPlans.map(plan => {
                        if (plan.id === planId) {
                            const newSteps = plan.steps.map(step => 
                                step.id === stepId ? { ...step, isCompleted: !step.isCompleted } : step
                            );
                            return { ...plan, steps: newSteps };
                        }
                        return plan;
                    });
                    return { ...manager, actionPlans: newActionPlans };
                }
                return manager;
            })
        };
    }

    case 'DELETE_ACTION_PLAN': {
        const { managerId, planId } = action.payload;
        return {
            ...state,
            managers: state.managers.map(manager => 
                manager.id === managerId
                    ? { ...manager, actionPlans: manager.actionPlans.filter(p => p.id !== planId) }
                    : manager
            )
        };
    }
    
    case 'ADD_ACTION_PLAN_COMMENT': {
        const { managerId, planId, commentText } = action.payload;
        const newComment: Comment = {
            id: `comment_${Date.now()}`,
            author: 'أنت', // Simplified author
            text: commentText,
            createdAt: new Date().toISOString(),
        };
         return {
            ...state,
            managers: state.managers.map(manager => {
                if (manager.id === managerId) {
                    const newActionPlans = manager.actionPlans.map(plan => {
                        if (plan.id === planId) {
                            return { ...plan, comments: [...plan.comments, newComment] };
                        }
                        return plan;
                    });
                    return { ...manager, actionPlans: newActionPlans };
                }
                return manager;
            })
        };
    }

    case 'UPDATE_ACTION_STEP_ASSIGNEE': {
        const { managerId, planId, stepId, assignee } = action.payload;
        return {
            ...state,
            managers: state.managers.map(manager => {
                if (manager.id === managerId) {
                    const newActionPlans = manager.actionPlans.map(plan => {
                        if (plan.id === planId) {
                            const newSteps = plan.steps.map(step => 
                                step.id === stepId ? { ...step, assignedTo: assignee } : step
                            );
                            return { ...plan, steps: newSteps };
                        }
                        return plan;
                    });
                    return { ...manager, actionPlans: newActionPlans };
                }
                return manager;
            })
        };
    }
    
    case 'UPDATE_KPI_TARGET': {
        const { kpiId, newTarget } = action.payload;
        const newManagers = state.managers.map(manager => {
            const newPillars = manager.pillars.map(pillar => {
                const newKpis = pillar.kpis.map(kpi => {
                    if (kpi.id === kpiId) {
                        return { ...kpi, target: newTarget };
                    }
                    return kpi;
                });
                return { ...pillar, kpis: newKpis };
            });
            return { ...manager, pillars: newPillars };
        });
        // Also update the master data in memory, if ALL_KPIS was stateful (it is not, it's a const)
        return { ...state, managers: newManagers };
    }

    case 'MARK_ALERT_READ': {
        const { alertId, all } = action.payload;
        return {
            ...state,
            alerts: state.alerts.map(alert => {
                if (all || alert.id === alertId) {
                    return { ...alert, isRead: true };
                }
                return alert;
            }),
        };
    }

    case 'ADD_TO_RISK_REGISTER': {
        const { risk, source } = action.payload;
        // Prevent adding duplicates from the same source
        const existingRisk = state.riskRegister.find(
            r => r.risk_title === risk.risk_title && r.source === source
        );
        if (existingRisk) {
            return state; // Don't add if it already exists
        }
        const newRisk: RegisteredRisk = {
            ...risk,
            id: `risk_${Date.now()}`,
            source,
            status: 'مفتوح',
            createdAt: new Date().toISOString(),
        };
        return {
            ...state,
            riskRegister: [newRisk, ...state.riskRegister],
        };
    }

    case 'UPDATE_RISK_STATUS': {
        const { riskId, newStatus } = action.payload;
        return {
            ...state,
            riskRegister: state.riskRegister.map(risk =>
                risk.id === riskId ? { ...risk, status: newStatus } : risk
            ),
        };
    }

    default:
      return state;
  }
};

// --- LOCAL STORAGE ---

const LOCAL_STORAGE_KEY = 'performanceDashboardState';

const getInitialState = (): State => {
    let state: State;
    try {
        const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            const managersWithDefaults = (savedState.managers || INITIAL_MANAGERS_DATA).map(m => ({
                ...m,
                actionPlans: (m.actionPlans || []).map(p => ({ ...p, comments: p.comments || [] })),
                pillars: m.pillars.map(p => ({
                    ...p,
                    kpis: p.kpis.map(k => ({
                        ...k,
                        history: k.history || []
                    }))
                }))
            }));

            state = {
                managers: managersWithDefaults,
                selectedManagerId: savedState.selectedManagerId || INITIAL_MANAGERS_DATA[0]?.id || null,
                currentView: savedState.currentView || 'manager',
                alerts: [], // Alerts are transient and recalculated on load
                currentTimePeriod: savedState.currentTimePeriod || 'monthly',
                riskRegister: savedState.riskRegister || [],
            };
        } else {
             state = {
                managers: INITIAL_MANAGERS_DATA,
                selectedManagerId: INITIAL_MANAGERS_DATA[0]?.id || null,
                currentView: 'manager',
                alerts: [],
                currentTimePeriod: 'monthly',
                riskRegister: [],
            };
        }
    } catch (e) {
        console.error("Failed to parse state from localStorage", e);
        state = {
            managers: INITIAL_MANAGERS_DATA,
            selectedManagerId: INITIAL_MANAGERS_DATA[0]?.id || null,
            currentView: 'manager',
            alerts: [],
            currentTimePeriod: 'monthly',
            riskRegister: [],
        };
    }

    // Recalculate alerts
    const newAlerts: Alert[] = [];
    state.managers.forEach(manager => {
        manager.pillars.forEach(pillar => {
            pillar.kpis.forEach(kpi => {
                const score = calculateKpiScore(kpi);
                if (score < 90) { // Alert threshold
                    newAlerts.push({
                        id: `alert_${manager.id}_${kpi.id}`,
                        managerId: manager.id,
                        managerName: manager.name,
                        kpiName: kpi.name,
                        kpiScore: score,
                        timestamp: new Date().toISOString(),
                        isRead: false,
                    });
                }
            });
        });
    });
    
    state.alerts = newAlerts.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return state;
};

// --- CONTEXT ---

export const AppStateContext = createContext<State>(getInitialState());
export const AppDispatchContext = createContext<React.Dispatch<Action>>(() => null);

// --- PROVIDER ---

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());

  useEffect(() => {
    try {
        const stateToSave = {
            ...state,
            managers: state.managers.filter(m => m.pillars && m.pillars.length > 0),
            alerts: [], // Don't save alerts to localStorage
        };
        const serializedState = JSON.stringify(stateToSave);
        localStorage.setItem(LOCAL_STORAGE_KEY, serializedState);
    } catch(e) {
        console.error("Failed to save state to localStorage", e);
    }
  }, [state]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
};