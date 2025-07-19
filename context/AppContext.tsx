import React, { createContext, useReducer, useEffect } from 'react';
import { createInitialManagersData, ROLE_TEMPLATES, deepCopy, calculateKpiScore, getCurrentMonthIdentifier } from '../data.tsx';
import type { Manager, ManagerRole, ActionPlan, Comment, Alert, TimePeriod, RegisteredRisk, RiskStatus, IdentifiedRisk, AuditChecklist, GeneratedChecklist, AuditChecklistItemStatus, StrategicGoal } from '../data.tsx';

// --- STATE AND ACTION TYPES ---

type State = {
  managers: Manager[];
  selectedManagerId: string | null;
  currentView: 'manager' | 'executive';
  alerts: Alert[];
  currentTimePeriod: TimePeriod;
  riskRegister: RegisteredRisk[];
  selectedMonth: string;
  realCurrentMonth: string;
  audits: AuditChecklist[];
  strategicGoals: StrategicGoal[];
};

type Action =
  | { type: 'SET_STATE'; payload: State }
  | { type: 'SET_VIEW'; payload: 'manager' | 'executive' }
  | { type: 'SET_SELECTED_MANAGER'; payload: string }
  | { type: 'SET_SELECTED_MONTH'; payload: string }
  | { type: 'ADD_MANAGER'; payload: { name: string; department: string; role: ManagerRole; } }
  | { type: 'UPDATE_MANAGER'; payload: Manager }
  | { type: 'DELETE_MANAGER'; payload: string }
  | { type: 'UPDATE_KPI'; payload: { pillarId: string; kpiId: string; value: number; } }
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
  | { type: 'UPDATE_RISK_STATUS'; payload: { riskId: string, newStatus: RiskStatus } }
  | { type: 'ADD_AUDIT_CHECKLIST'; payload: { prompt: string, checklist: GeneratedChecklist } }
  | { type: 'UPDATE_AUDIT_ITEM_STATUS'; payload: { checklistId: string, itemId: string, status: AuditChecklistItemStatus } }
  | { type: 'UPDATE_AUDIT_ITEM_NOTES'; payload: { checklistId: string, itemId: string, notes: string } }
  | { type: 'ADD_STRATEGIC_GOAL'; payload: Omit<StrategicGoal, 'id' | 'createdAt'> }
  | { type: 'UPDATE_STRATEGIC_GOAL'; payload: StrategicGoal }
  | { type: 'DELETE_STRATEGIC_GOAL'; payload: string }
  | { type: 'RESET_ALL_HISTORY'; };


// --- HELPER FUNCTIONS ---

/**
 * Creates a new manager object with KPI values updated for a specific month using immutable updates.
 * @param manager The manager object.
 * @param month The month identifier (e.g., '2024-07').
 * @returns A new manager object with updated KPI values.
 */
const updateManagerKpisForMonth = (manager: Manager, month: string): Manager => {
    return {
        ...manager,
        pillars: manager.pillars.map(pillar => ({
            ...pillar,
            kpis: pillar.kpis.map(kpi => {
                const historyEntry = kpi.history.find(h => h.date.startsWith(month));
                return {
                    ...kpi,
                    value: historyEntry ? historyEntry.value : 0,
                };
            }),
        })),
    };
};


// --- REDUCER ---

const appReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_STATE':
        return action.payload;
    
    case 'SET_VIEW':
        return { ...state, currentView: action.payload };

    case 'SET_TIME_PERIOD':
        return { ...state, currentTimePeriod: action.payload };
    
    case 'SET_SELECTED_MANAGER': {
      const newSelectedManagerId = action.payload;
      if (!newSelectedManagerId) {
          return { ...state, selectedManagerId: null };
      }
      
      const monthToView = state.selectedMonth;

      return {
          ...state,
          selectedManagerId: newSelectedManagerId,
          managers: state.managers.map(manager =>
              manager.id === newSelectedManagerId
                  ? updateManagerKpisForMonth(manager, monthToView) // Sync new manager to current month
                  : manager
          ),
      };
    }

    case 'SET_SELECTED_MONTH': {
        const newSelectedMonth = action.payload;
        if (newSelectedMonth === state.selectedMonth) return state;

        const selectedManagerId = state.selectedManagerId;

        // If a manager is selected, update their KPI values to reflect the new month's data
        const newManagers = selectedManagerId ? state.managers.map(manager => {
            if (manager.id === selectedManagerId) {
                return updateManagerKpisForMonth(manager, newSelectedMonth);
            }
            return manager;
        }) : state.managers;

        return {
            ...state,
            selectedMonth: newSelectedMonth,
            managers: newManagers,
        };
    }


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
      const newManagers = [...state.managers, newManager];
      const newSelectedId = newManager.id;
      const currentMonth = state.realCurrentMonth;
      
      // Sync the new manager's view to the current month, which will show 0s
      const finalManagers = newManagers.map(m => {
          if (m.id === newSelectedId) {
             return updateManagerKpisForMonth(m, currentMonth);
          }
          return m;
      });

      return {
        ...state,
        managers: finalManagers,
        selectedManagerId: newSelectedId,
        selectedMonth: currentMonth,
        currentView: 'manager',
      };
    }
    
    case 'UPDATE_MANAGER': {
        const updatedManager = action.payload;
        // Also ensure the KPI values are consistent with the currently selected month
        const consistentManager = updateManagerKpisForMonth(updatedManager, state.selectedMonth);
        return {
            ...state,
            managers: state.managers.map(m => m.id === consistentManager.id ? consistentManager : m)
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
      const monthToUpdate = state.realCurrentMonth; // Always save to the REAL current month
      
      return {
        ...state,
        managers: state.managers.map(manager => {
          if (manager.id !== state.selectedManagerId) {
            return manager;
          }

          const managerWithUpdatedHistory = {
            ...manager,
            pillars: manager.pillars.map(pillar => {
              if (pillar.id !== pillarId) return pillar;
              
              return {
                ...pillar,
                kpis: pillar.kpis.map(kpi => {
                  if (kpi.id !== kpiId) return kpi;
                  
                  const historyIndex = kpi.history.findIndex(h => h.date.startsWith(monthToUpdate));
                  const dateForMonth = new Date(`${monthToUpdate}-15T12:00:00Z`).toISOString();
                  let newHistory;

                  if (historyIndex > -1) {
                      newHistory = kpi.history.map((h, index) => index === historyIndex ? { ...h, value } : h);
                  } else {
                      newHistory = [...kpi.history, { date: dateForMonth, value }];
                  }

                  return { ...kpi, history: newHistory };
                }),
              };
            }),
          };
          
          return updateManagerKpisForMonth(managerWithUpdatedHistory, state.selectedMonth);
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
    
    case 'ADD_AUDIT_CHECKLIST': {
        const { prompt, checklist } = action.payload;
        const newChecklist: AuditChecklist = {
            id: `audit_${Date.now()}`,
            prompt,
            title: checklist.checklist_title,
            createdAt: new Date().toISOString(),
            items: checklist.items.map((item, index) => ({
                id: `item_${Date.now()}_${index}`,
                text: item.item_text,
                category: item.category,
                riskLevel: item.risk_level,
                status: 'pending',
                notes: '',
            }))
        };
        return { ...state, audits: [newChecklist, ...state.audits] };
    }

    case 'UPDATE_AUDIT_ITEM_STATUS': {
        const { checklistId, itemId, status } = action.payload;
        return {
            ...state,
            audits: state.audits.map(checklist => {
                if (checklist.id === checklistId) {
                    return {
                        ...checklist,
                        items: checklist.items.map(item =>
                            item.id === itemId ? { ...item, status } : item
                        ),
                    };
                }
                return checklist;
            }),
        };
    }
    
    case 'UPDATE_AUDIT_ITEM_NOTES': {
        const { checklistId, itemId, notes } = action.payload;
        return {
            ...state,
            audits: state.audits.map(checklist => {
                if (checklist.id === checklistId) {
                    return {
                        ...checklist,
                        items: checklist.items.map(item =>
                            item.id === itemId ? { ...item, notes } : item
                        ),
                    };
                }
                return checklist;
            }),
        };
    }
      
    case 'ADD_STRATEGIC_GOAL': {
        const newGoal: StrategicGoal = {
            ...action.payload,
            id: `goal_${Date.now()}`,
            createdAt: new Date().toISOString(),
        };
        return { ...state, strategicGoals: [newGoal, ...state.strategicGoals] };
    }

    case 'UPDATE_STRATEGIC_GOAL': {
        return {
            ...state,
            strategicGoals: state.strategicGoals.map(g => g.id === action.payload.id ? action.payload : g),
        };
    }

    case 'DELETE_STRATEGIC_GOAL': {
        return {
            ...state,
            strategicGoals: state.strategicGoals.filter(g => g.id !== action.payload),
        };
    }

    case 'RESET_ALL_HISTORY': {
        const initialManagers = createInitialManagersData();
        const firstManagerId = initialManagers[0]?.id || null;
        const currentMonth = getCurrentMonthIdentifier();
        let syncedManagers = initialManagers;
        
        // Sync the first manager to the current month to show 0s
        if(firstManagerId) {
            syncedManagers = initialManagers.map(m => m.id === firstManagerId ? updateManagerKpisForMonth(m, currentMonth) : m);
        }

        return {
            managers: syncedManagers,
            selectedManagerId: firstManagerId,
            currentView: 'manager',
            alerts: [], // Alerts will be recalculated on next load
            currentTimePeriod: 'monthly',
            riskRegister: [],
            selectedMonth: currentMonth,
            realCurrentMonth: currentMonth,
            audits: [],
            strategicGoals: [],
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
    const initialManagersData = createInitialManagersData();
    const initialSelectedManagerId = initialManagersData.length > 0 ? initialManagersData[0].id : null;
    const currentMonth = getCurrentMonthIdentifier();

    try {
        const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            const managersSource = savedState.managers && savedState.managers.length > 0
                ? savedState.managers
                : initialManagersData;

            const managersWithDefaults = managersSource.map(m => ({
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
                selectedManagerId: savedState.selectedManagerId || initialSelectedManagerId,
                currentView: savedState.currentView || 'manager',
                alerts: [], // Alerts are transient and recalculated on load
                currentTimePeriod: savedState.currentTimePeriod || 'monthly',
                riskRegister: savedState.riskRegister || [],
                selectedMonth: currentMonth, // ALWAYS use current month on initial load
                realCurrentMonth: currentMonth, // This is the source of truth for the actual current month
                audits: savedState.audits || [],
                strategicGoals: savedState.strategicGoals || [],
            };
        } else {
             state = {
                managers: initialManagersData,
                selectedManagerId: initialSelectedManagerId,
                currentView: 'manager',
                alerts: [],
                currentTimePeriod: 'monthly',
                riskRegister: [],
                selectedMonth: currentMonth,
                realCurrentMonth: currentMonth,
                audits: [],
                strategicGoals: [],
            };
        }
    } catch (e) {
        console.error("Failed to parse state from localStorage", e);
        state = {
            managers: initialManagersData,
            selectedManagerId: initialSelectedManagerId,
            currentView: 'manager',
            alerts: [],
            currentTimePeriod: 'monthly',
            riskRegister: [],
            selectedMonth: currentMonth,
            realCurrentMonth: currentMonth,
            audits: [],
            strategicGoals: [],
        };
    }

    // On initial load, sync the selected manager's values to the current month.
    const managerToSelectId = state.selectedManagerId;
    if (managerToSelectId) {
        const managerToSelect = state.managers.find(m => m.id === managerToSelectId);
        if (managerToSelect) {
            // Sync the live KPI values for the selected manager.
            state.managers = state.managers.map(m => 
                m.id === managerToSelectId ? updateManagerKpisForMonth(m, currentMonth) : m
            );
        } else {
            // Handle case where selectedManagerId from localStorage is invalid
            state.selectedManagerId = state.managers[0]?.id || null;
            if (state.selectedManagerId) {
                state.managers = state.managers.map((m, i) => i === 0 ? updateManagerKpisForMonth(m, currentMonth) : m);
            }
        }
    }

    // Recalculate alerts for the current month
    const newAlerts: Alert[] = [];
    state.managers.forEach(manager => {
        const managerForAlerts = updateManagerKpisForMonth(manager, state.selectedMonth);
        managerForAlerts.pillars.forEach(pillar => {
            pillar.kpis.forEach(kpi => {
                const score = calculateKpiScore(kpi);
                if (score < 90) { // Alert threshold
                    newAlerts.push({
                        id: `alert_${manager.id}_${kpi.id}_${state.selectedMonth}`,
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
            selectedMonth: undefined, // Don't save selectedMonth, it will be recalculated on load
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