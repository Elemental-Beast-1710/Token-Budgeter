import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  Trash2,
  Edit2,
  HelpCircle,
  X,
} from 'lucide-react';
import { ProjectBudget, UsageEvent } from '../../types';
import { formatCurrency } from '../../services/currency';

interface ProjectsViewProps {
  projects: ProjectBudget[];
  events: UsageEvent[];
  currency: string;
  onSaveProject: (project: ProjectBudget) => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  events,
  currency,
  onSaveProject,
  onDeleteProject,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Partial<ProjectBudget>>({
    name: '',
    description: '',
    monthlyLimitUsd: 100,
    warningThresholdPercent: 80,
    color: '#7C6FF7',
  });

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditing) {
        setIsEditing(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing]);

  // Calculate actual spend and metrics per project
  const projectStats = projects.map((proj) => {
    const projEvents = events.filter((e) => e.project.toLowerCase() === proj.name.toLowerCase());
    const totalSpend = projEvents.reduce((s, e) => s + (e.reportedCost || 0), 0);
    const totalTokens = projEvents.reduce((s, e) => s + (e.inputTokens + e.outputTokens), 0);
    const totalRequests = projEvents.reduce((s, e) => s + (e.requestCount || 1), 0);
    const retryCount = projEvents.reduce((s, e) => s + (e.retryCount || 0), 0);
    const eventsWithQuality = projEvents.filter((e) => e.qualityScore !== null);
    const avgQuality =
      eventsWithQuality.length > 0
        ? eventsWithQuality.reduce((s, e) => s + (e.qualityScore || 0), 0) / eventsWithQuality.length
        : null;

    // Distinct tasks
    const tasksMap = new Map<string, { count: number; spend: number; retries: number }>();
    for (const e of projEvents) {
      const current = tasksMap.get(e.task) || { count: 0, spend: 0, retries: 0 };
      current.count += e.requestCount || 1;
      current.spend += e.reportedCost || 0;
      current.retries += e.retryCount || 0;
      tasksMap.set(e.task, current);
    }

    const spendPercent = proj.monthlyLimitUsd > 0 ? (totalSpend / proj.monthlyLimitUsd) * 100 : 0;
    const isOverBudget = totalSpend > proj.monthlyLimitUsd;
    const isNearWarning = spendPercent >= proj.warningThresholdPercent && !isOverBudget;

    return {
      project: proj,
      eventsCount: projEvents.length,
      totalSpend,
      totalTokens,
      totalRequests,
      retryCount,
      avgQuality,
      hasMissingQuality: eventsWithQuality.length < projEvents.length,
      spendPercent,
      isOverBudget,
      isNearWarning,
      tasks: Array.from(tasksMap.entries()).map(([taskName, data]) => ({
        taskName,
        ...data,
      })),
    };
  });

  const handleOpenCreate = () => {
    setEditingProject({
      id: `proj_${Date.now()}`,
      name: '',
      description: '',
      monthlyLimitUsd: 100,
      warningThresholdPercent: 80,
      color: '#7C6FF7',
      createdAt: new Date().toISOString(),
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (proj: ProjectBudget) => {
    setEditingProject({ ...proj });
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject.name?.trim()) return;

    onSaveProject({
      id: editingProject.id || `proj_${Date.now()}`,
      name: editingProject.name.trim(),
      description: editingProject.description || '',
      monthlyLimitUsd: Number(editingProject.monthlyLimitUsd) || 100,
      warningThresholdPercent: Number(editingProject.warningThresholdPercent) || 80,
      color: editingProject.color || '#7C6FF7',
      createdAt: editingProject.createdAt || new Date().toISOString(),
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* View Header with Project Creation CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151518] border border-[#29292F] p-4 rounded-lg">
        <div>
          <h2 className="text-sm font-semibold text-[#EDEDEF] flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-[#7C6FF7]" />
            <span>Projects & Budget Management</span>
          </h2>
          <p className="text-[11px] text-[#8B8B94] mt-0.5">
            Configure financial spending caps, threshold warnings, and monitor task-level consumption.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6B5EE4] rounded-md transition-colors shrink-0 shadow-2xs focus:outline-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Budget Cap</span>
        </button>
      </div>

      {/* Empty State */}
      {projects.length === 0 ? (
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-12 text-center space-y-3">
          <FolderGit2 className="w-8 h-8 text-[#5E5E68] mx-auto stroke-[1.5]" />
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-[#EDEDEF]">No Project Budgets Configured</h3>
            <p className="text-[11px] text-[#8B8B94] max-w-sm mx-auto">
              Track multi-agent pipelines and engineering teams against explicit monthly limits by setting up project budgets.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6B5EE4] rounded-md transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Budget</span>
          </button>
        </div>
      ) : (
        /* Project Cards Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projectStats.map((item) => {
            const { project, totalSpend, spendPercent, isOverBudget, isNearWarning, tasks } = item;

            return (
              <div
                key={project.id}
                className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-3 flex flex-col justify-between hover:border-[#3B3B42] transition-colors"
              >
                <div className="space-y-3">
                  {/* Project Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: project.color || '#7C6FF7' }}
                        />
                        <h3 className="text-xs font-semibold text-[#EDEDEF] tracking-tight">{project.name}</h3>
                      </div>
                      {project.description && (
                        <p className="text-[11px] text-[#8B8B94]">{project.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(project)}
                        aria-label={`Edit ${project.name}`}
                        className="p-1 rounded text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#1C1C20] transition-colors focus:outline-none"
                        title="Edit project budget"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete project budget "${project.name}"?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        aria-label={`Delete ${project.name}`}
                        className="p-1 rounded text-[#8B8B94] hover:text-rose-400 hover:bg-[#1C1C20] transition-colors focus:outline-none"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Spending Progress Bar */}
                  <div className="space-y-1.5 bg-[#101012] p-2.5 rounded-md border border-[#29292F]">
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#8B8B94] text-[11px]">Spend:</span>
                        <span className="text-[#EDEDEF] font-semibold tabular-nums">
                          {formatCurrency(totalSpend, currency)}
                        </span>
                      </div>
                      <div className="text-[11px]">
                        <span className="text-[#5E5E68]">Limit: </span>
                        <span className="text-[#8B8B94] tabular-nums">
                          {formatCurrency(project.monthlyLimitUsd, currency)}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-[#151518] h-1.5 rounded-full overflow-hidden border border-[#222226]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOverBudget
                            ? 'bg-rose-500'
                            : isNearWarning
                            ? 'bg-amber-400'
                            : 'bg-[#7C6FF7]'
                        }`}
                        style={{ width: `${Math.min(100, spendPercent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span
                        className={
                          isOverBudget
                            ? 'text-rose-400 font-medium'
                            : isNearWarning
                            ? 'text-amber-400 font-medium'
                            : 'text-[#8B8B94]'
                        }
                      >
                        {spendPercent.toFixed(1)}% consumed
                      </span>
                      <span className="text-[#5E5E68]">
                        Alert at {project.warningThresholdPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Key Metrics Strip */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[#101012] p-2 rounded-md border border-[#29292F]">
                    <div>
                      <span className="text-[9px] text-[#5E5E68] block uppercase">Tokens</span>
                      <span className="text-[#EDEDEF] tabular-nums font-medium">
                        {(item.totalTokens / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#5E5E68] block uppercase">Requests</span>
                      <span className="text-[#EDEDEF] tabular-nums font-medium">
                        {item.totalRequests}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#5E5E68] block uppercase">Quality</span>
                      <span className="text-emerald-400 tabular-nums font-medium">
                        {item.avgQuality ? `${item.avgQuality.toFixed(0)}/100` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Tasks Breakdown */}
                  <div className="space-y-1 pt-1">
                    <h4 className="text-[10px] font-medium text-[#8B8B94] font-mono uppercase tracking-wider">Task Breakdown</h4>
                    {tasks.length === 0 ? (
                      <div className="text-[11px] text-[#5E5E68]">No active events for this project.</div>
                    ) : (
                      <div className="divide-y divide-[#222226] font-mono text-xs max-h-32 overflow-y-auto pr-1">
                        {tasks.map((t) => (
                          <div key={t.taskName} className="py-1 flex items-center justify-between text-[#8B8B94]">
                            <div className="truncate max-w-[65%]">
                              <span className="font-sans text-[#EDEDEF]">{t.taskName}</span>
                              <span className="text-[10px] text-[#5E5E68] ml-2">
                                {t.count} calls · {t.retries} retries
                              </span>
                            </div>
                            <div className="tabular-nums font-medium text-[#EDEDEF]">
                              ${t.spend.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {item.hasMissingQuality && (
                  <div className="pt-2 border-t border-[#222226] text-[10px] text-[#5E5E68] flex items-center gap-1.5 font-mono">
                    <HelpCircle className="w-3 h-3 text-[#5E5E68] shrink-0" />
                    <span>Some events missing quality evaluation telemetry.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Modal */}
      {isEditing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
          className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
        >
          <form
            onSubmit={handleSubmit}
            className="bg-[#151518] border border-[#29292F] rounded-lg max-w-md w-full p-4 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#29292F] pb-2">
              <h3 id="project-modal-title" className="text-xs font-semibold text-[#EDEDEF]">
                {editingProject.id?.startsWith('proj_') && !projects.some((p) => p.id === editingProject.id)
                  ? 'Create Project Budget'
                  : 'Edit Project Budget'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                aria-label="Close modal"
                className="p-1 rounded text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#1C1C20]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[#8B8B94] block mb-1 font-medium text-[11px]">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CodeAssistant-Core"
                  value={editingProject.name || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="w-full bg-[#101012] border border-[#29292F] rounded-md px-2.5 py-1 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7]"
                />
              </div>

              <div>
                <label className="text-[#8B8B94] block mb-1 font-medium text-[11px]">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Autonomous refactoring tasks"
                  value={editingProject.description || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full bg-[#101012] border border-[#29292F] rounded-md px-2.5 py-1 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[#8B8B94] block mb-1 font-medium text-[11px]">Monthly Limit ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    value={editingProject.monthlyLimitUsd ?? 100}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        monthlyLimitUsd: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#101012] border border-[#29292F] rounded-md px-2.5 py-1 text-[#EDEDEF] font-mono focus:outline-none focus:border-[#7C6FF7]"
                  />
                </div>
                <div>
                  <label className="text-[#8B8B94] block mb-1 font-medium text-[11px]">Warning Threshold (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={editingProject.warningThresholdPercent ?? 80}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        warningThresholdPercent: parseInt(e.target.value, 10) || 80,
                      })
                    }
                    className="w-full bg-[#101012] border border-[#29292F] rounded-md px-2.5 py-1 text-[#EDEDEF] font-mono focus:outline-none focus:border-[#7C6FF7]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[#29292F]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs text-[#8B8B94] hover:text-[#EDEDEF] rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6B5EE4] rounded-md transition-colors shadow-2xs"
              >
                Save Project
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
