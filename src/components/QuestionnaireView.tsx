import { calculateDiscoveryCoverage } from '../data/derivationEngine';
import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Filter,
  Check,
  Info,
  Sparkles,
  Layers,
  ChevronDown,
  FileCheck2,
  Plus,
  Trash2,
  Ban,
  Sliders,
  Hash,
  Calendar,
  Settings2,
  Code2,
} from 'lucide-react';
import { Question, Project, DiscoveryDomain } from '../types.js';
import { DISCOVERY_DOMAINS, getDomainMetadata } from '../data/discoveryCatalog.js';

interface QuestionnaireViewProps {
  project: Project;
  questions?: Question[];
  onAnswerQuestion: (
    questionId: string,
    answer: any,
    state?: any,
    justification?: string
  ) => Promise<void>;
  onOpenOverrideModal: (gateName: string) => void;
  selectedQuestionId?: string;
}

export const QuestionnaireView: React.FC<QuestionnaireViewProps> = ({
  project,
  questions = [],
  onAnswerQuestion,
  onOpenOverrideModal,
  selectedQuestionId,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [filter, setFilter] = useState<'ALL' | 'BLOCKING' | 'UNRESOLVED'>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [customJustification, setCustomJustification] = useState<string>('');

  // Form input states for complex answer types
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [customOptionInput, setCustomOptionInput] = useState<string>('');
  const [numberVal, setNumberVal] = useState<string>('');
  const [textVal, setTextVal] = useState<string>('');
  const [rangeMin, setRangeMin] = useState<string>('');
  const [rangeMax, setRangeMax] = useState<string>('');
  const [durationVal, setDurationVal] = useState<string>('');
  const [keyValuePairs, setKeyValuePairs] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);
  const [techMode, setTechMode] = useState<'USER_SPECIFIED' | 'RECOMMEND_FOR_ME' | 'UNKNOWN'>('USER_SPECIFIED');
  const [techVal, setTechVal] = useState<string>('');
  const [isNaModalOpen, setIsNaModalOpen] = useState<boolean>(false);
  const [naJustification, setNaJustification] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const filteredQuestions = questions.filter((q) => {
    if (selectedDomain !== 'ALL') {
      const qDomain = q.domain || q.category?.toUpperCase();
      if (qDomain !== selectedDomain && q.category !== selectedDomain.toLowerCase()) {
        return false;
      }
    }
    if (filter === 'BLOCKING') return q.importance === 'BLOCKING';
    if (filter === 'UNRESOLVED') return q.state === 'UNRESOLVED';
    return true;
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (selectedQuestionId) {
      const found = questions.findIndex((q) => q.id === selectedQuestionId);
      if (found !== -1) return found;
    }
    return 0;
  });

  const activeQuestion = filteredQuestions[currentIndex] || filteredQuestions[0] || questions[0];

  // Sync component local state whenever activeQuestion changes
  useEffect(() => {
    if (!activeQuestion) return;
    setValidationError(null);
    setCustomJustification(activeQuestion.justification || '');
    setCustomOptionInput('');

    // MULTI_SELECT
    if (activeQuestion.answerType === 'MULTI_SELECT') {
      if (Array.isArray(activeQuestion.answer)) {
        setSelectedMulti(activeQuestion.answer);
      } else if (typeof activeQuestion.answer === 'string' && activeQuestion.answer) {
        setSelectedMulti([activeQuestion.answer]);
      } else {
        setSelectedMulti([]);
      }
    }

    // NUMBER
    if (activeQuestion.answerType === 'NUMBER') {
      setNumberVal(activeQuestion.answer !== undefined && activeQuestion.answer !== null ? String(activeQuestion.answer) : '');
    }

    // FREE_TEXT / LONG_TEXT
    if (activeQuestion.answerType === 'FREE_TEXT' || activeQuestion.answerType === 'LONG_TEXT') {
      setTextVal(typeof activeQuestion.answer === 'string' ? activeQuestion.answer : '');
    }

    // RANGE
    if (activeQuestion.answerType === 'RANGE') {
      if (typeof activeQuestion.answer === 'string' && activeQuestion.answer.includes('-')) {
        const parts = activeQuestion.answer.split('-');
        setRangeMin(parts[0] || '');
        setRangeMax(parts[1] || '');
      } else {
        setRangeMin('');
        setRangeMax('');
      }
    }

    // DATE_OR_DURATION
    if (activeQuestion.answerType === 'DATE_OR_DURATION') {
      setDurationVal(typeof activeQuestion.answer === 'string' ? activeQuestion.answer : '');
    }

    // KEY_VALUE_LIST
    if (activeQuestion.answerType === 'KEY_VALUE_LIST') {
      if (activeQuestion.answer && typeof activeQuestion.answer === 'object' && !Array.isArray(activeQuestion.answer)) {
        const entries = Object.entries(activeQuestion.answer).map(([k, v]) => ({ key: k, value: String(v) }));
        setKeyValuePairs(entries.length > 0 ? entries : [{ key: '', value: '' }]);
      } else if (Array.isArray(activeQuestion.answer) && activeQuestion.answer.length > 0) {
        setKeyValuePairs(activeQuestion.answer);
      } else {
        setKeyValuePairs([{ key: '', value: '' }]);
      }
    }

    // TECH_DECISION
    if (activeQuestion.answerType === 'TECH_DECISION') {
      if (activeQuestion.answer) {
        setTechVal(String(activeQuestion.answer));
        setTechMode('USER_SPECIFIED');
      } else {
        setTechVal('');
        setTechMode('USER_SPECIFIED');
      }
    }
  }, [activeQuestion?.id]);

  const handleSaveAnswer = async (answerPayload: any, customState: 'ANSWERED' | 'NOT_APPLICABLE' | 'DEFERRED' = 'ANSWERED', explicitJustification?: string) => {
    if (!activeQuestion) return;
    setIsSaving(true);
    setValidationError(null);
    try {
      const justificationToRecord = explicitJustification || customJustification;
      await onAnswerQuestion(activeQuestion.id, answerPayload, customState, justificationToRecord);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save answer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMultiSelect = (val: string) => {
    const next = selectedMulti.includes(val)
      ? selectedMulti.filter((v) => v !== val)
      : [...selectedMulti, val];
    
    // Check max cardinality if specified
    if (activeQuestion?.cardinality?.max && next.length > activeQuestion.cardinality.max) {
      setValidationError(`Maximum of ${activeQuestion.cardinality.max} selections permitted.`);
      return;
    }
    setValidationError(null);
    setSelectedMulti(next);
  };

  const handleAddCustomOption = () => {
    if (!customOptionInput.trim()) return;
    const sanitized = customOptionInput.trim();
    if (!selectedMulti.includes(sanitized)) {
      if (activeQuestion?.cardinality?.max && selectedMulti.length >= activeQuestion.cardinality.max) {
        setValidationError(`Maximum of ${activeQuestion.cardinality.max} selections reached.`);
        return;
      }
      setSelectedMulti([...selectedMulti, sanitized]);
    }
    setCustomOptionInput('');
    setValidationError(null);
  };

  const handleSaveMultiSelect = async () => {
    if (!activeQuestion) return;
    const minCard = activeQuestion.cardinality?.min ?? 1;
    if (selectedMulti.length < minCard) {
      setValidationError(`Please select at least ${minCard} option${minCard > 1 ? 's' : ''}.`);
      return;
    }
    await handleSaveAnswer(selectedMulti);
  };

  const handleSaveNumber = async () => {
    if (!activeQuestion) return;
    const num = Number(numberVal);
    if (isNaN(num)) {
      setValidationError('Please enter a valid numeric value.');
      return;
    }
    if (activeQuestion.validation?.minNumeric !== undefined && num < activeQuestion.validation.minNumeric) {
      setValidationError(`Value must be at least ${activeQuestion.validation.minNumeric}.`);
      return;
    }
    if (activeQuestion.validation?.maxNumeric !== undefined && num > activeQuestion.validation.maxNumeric) {
      setValidationError(`Value must not exceed ${activeQuestion.validation.maxNumeric}.`);
      return;
    }
    await handleSaveAnswer(num);
  };

  const handleSaveRange = async () => {
    if (!activeQuestion) return;
    const min = Number(rangeMin);
    const max = Number(rangeMax);
    if (isNaN(min) || isNaN(max)) {
      setValidationError('Please enter valid numeric minimum and maximum values.');
      return;
    }
    if (min > max) {
      setValidationError('Minimum value cannot exceed maximum value.');
      return;
    }
    if (activeQuestion.validation?.minNumeric !== undefined && min < activeQuestion.validation.minNumeric) {
      setValidationError(`Minimum must be at least ${activeQuestion.validation.minNumeric}.`);
      return;
    }
    if (activeQuestion.validation?.maxNumeric !== undefined && max > activeQuestion.validation.maxNumeric) {
      setValidationError(`Maximum must not exceed ${activeQuestion.validation.maxNumeric}.`);
      return;
    }
    await handleSaveAnswer(`${min}-${max}`);
  };

  const handleSaveKeyValue = async () => {
    const validPairs = keyValuePairs.filter((p) => p.key.trim() !== '');
    if (validPairs.length === 0 && activeQuestion.requiredness?.level === 'CORE_MANDATORY') {
      setValidationError('Please define at least one configuration parameter.');
      return;
    }
    const map: Record<string, string> = {};
    validPairs.forEach((p) => {
      map[p.key.trim()] = p.value.trim();
    });
    await handleSaveAnswer(map);
  };

  const handleMarkNotApplicable = async () => {
    if (!naJustification.trim()) {
      setValidationError('A specific architectural or scope justification is required to mark as NOT APPLICABLE.');
      return;
    }
    await handleSaveAnswer('NOT_APPLICABLE', 'NOT_APPLICABLE', naJustification.trim());
    setIsNaModalOpen(false);
    setNaJustification('');
  };

  const coverage = calculateDiscoveryCoverage(questions, project);
  const resolvedCount = questions.filter((q) => q.state === 'ANSWERED').length;
  const blockingCount = questions.filter((q) => q.importance === 'BLOCKING' && q.state === 'UNRESOLVED').length;
  const deferredCount = questions.filter((q) => q.state === 'DEFERRED').length;
  const naCount = questions.filter((q) => q.state === 'NOT_APPLICABLE').length;
  const readinessPercent = questions.length > 0 ? Math.round(((resolvedCount + naCount) / questions.length) * 100) : 0;

  // Calculate domain-level progress
  const domainStats = DISCOVERY_DOMAINS.map((dom) => {
    const domainQs = questions.filter(
      (q) => (q.domain === dom) || (q.category?.toUpperCase() === dom) || (q.category === dom.toLowerCase())
    );
    const answered = domainQs.filter((q) => q.state === 'ANSWERED' || q.state === 'NOT_APPLICABLE').length;
    const blocking = domainQs.filter((q) => q.importance === 'BLOCKING' && q.state === 'UNRESOLVED').length;
    return {
      domain: dom,
      meta: getDomainMetadata(dom),
      total: domainQs.length,
      answered,
      blocking,
      percentage: domainQs.length > 0 ? Math.round((answered / domainQs.length) * 100) : 100,
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <section className="bg-white border rounded p-4 overflow-x-auto"><h2 className="font-bold mb-3">Discovery domain coverage</h2><table className="w-full text-xs"><thead><tr>{['Domain','Status','Coverage','Source','Open'].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{coverage.domainSummaries.map(d=><tr key={d.domain} className="border-t"><td className="p-2">{d.domain}</td><td>{d.status}</td><td>{d.coveragePercentage}%</td><td>{d.source}</td><td>{d.openItems}</td></tr>)}</tbody></table></section>
      {/* Workspace Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Sparkles className="w-4 h-4" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Adaptive Discovery & Derivation Workspace
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Covers 19 comprehensive engineering domains with full answer-type cardinality and rigorous verification gates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({questions.length})
          </button>
          <button
            onClick={() => setFilter('BLOCKING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filter === 'BLOCKING' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Blockers ({blockingCount})
          </button>
          <button
            onClick={() => setFilter('UNRESOLVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filter === 'UNRESOLVED' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Unresolved
          </button>
        </div>
      </div>

      {/* Domain Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max text-xs">
          <button
            onClick={() => {
              setSelectedDomain('ALL');
              setCurrentIndex(0);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              selectedDomain === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Domains ({questions.length})
          </button>
          {domainStats.map((ds) => (
            <button
              key={ds.domain}
              onClick={() => {
                setSelectedDomain(ds.domain);
                setCurrentIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedDomain === ds.domain
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{ds.meta.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  selectedDomain === ds.domain
                    ? 'bg-emerald-800 text-emerald-100'
                    : ds.percentage === 100
                    ? 'bg-emerald-100 text-emerald-800'
                    : ds.blocking > 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {ds.answered}/{ds.total}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: 8 Cols Question, 4 Cols Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Question Panel */}
        <div className="lg:col-span-8 space-y-6">
          {activeQuestion ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
              {/* Question Progress Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                    {activeQuestion.id}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Question {currentIndex + 1} of {filteredQuestions.length} in this view
                  </span>
                  {activeQuestion.domain && (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded uppercase">
                      {activeQuestion.domain}
                    </span>
                  )}
                  {activeQuestion.answerType && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono">
                      {activeQuestion.answerType}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeQuestion.state === 'NOT_APPLICABLE' ? (
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1">
                      <Ban className="w-3 h-3 text-slate-500" /> NOT APPLICABLE
                    </span>
                  ) : activeQuestion.importance === 'BLOCKING' ? (
                    <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                      BLOCKING GATE
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {activeQuestion.importance}
                    </span>
                  )}
                </div>
              </div>

              {/* Question Title & Reasoning */}
              <div>
                <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight leading-snug">
                  {activeQuestion.question}
                </h2>

                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
                  <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="space-y-1.5 w-full">
                    <strong className="text-slate-800 font-semibold block">Context & Rationale:</strong>
                    <p className="leading-relaxed">{activeQuestion.contextReason}</p>
                    {activeQuestion.standards?.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600">Governing Standards:</span>
                        {activeQuestion.standards.map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-purple-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Validation Error Banner */}
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* ANSWER TYPE RENDERERS */}

              {/* 1. MULTI_SELECT RENDERER */}
              {activeQuestion.answerType === 'MULTI_SELECT' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Select Multiple Options:</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                        {activeQuestion.cardinality
                          ? `Min: ${activeQuestion.cardinality.min || 1} | Max: ${activeQuestion.cardinality.max || 'Unlimited'}`
                          : 'Select one or more'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-800">
                      {selectedMulti.length} selected
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeQuestion.options?.map((opt) => {
                      const isChecked = selectedMulti.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => handleToggleMultiSelect(opt.value)}
                          className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                            isChecked
                              ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-xs md:text-sm font-semibold text-slate-900">
                              {opt.label}
                            </div>
                            {opt.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Allow Custom Option */}
                  {activeQuestion.allow_custom && (
                    <div className="pt-2">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Add Custom Option:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type custom entry..."
                          value={customOptionInput}
                          onChange={(e) => setCustomOptionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomOption();
                            }
                          }}
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomOption}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveMultiSelect}
                      disabled={isSaving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Save Selection ({selectedMulti.length})
                    </button>
                  </div>
                </div>
              )}

              {/* 2. BOOLEAN RENDERER */}
              {activeQuestion.answerType === 'BOOLEAN' && (
                <div className="space-y-4">
                  <span className="text-xs font-bold text-slate-700 block">Select True/False Decision:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleSaveAnswer('true')}
                      disabled={isSaving}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        String(activeQuestion.answer) === 'true'
                          ? 'border-emerald-600 bg-emerald-50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          String(activeQuestion.answer) === 'true' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                        }`}>
                          {String(activeQuestion.answer) === 'true' && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">Yes / Enforce Mandate</div>
                          <div className="text-xs text-slate-500 mt-0.5">Applies strict enforcement and derives requirements</div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveAnswer('false')}
                      disabled={isSaving}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        String(activeQuestion.answer) === 'false'
                          ? 'border-slate-800 bg-slate-100 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          String(activeQuestion.answer) === 'false' ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-300'
                        }`}>
                          {String(activeQuestion.answer) === 'false' && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">No / Advisory Only</div>
                          <div className="text-xs text-slate-500 mt-0.5">Does not enforce hard CI gate block</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. NUMBER RENDERER */}
              {activeQuestion.answerType === 'NUMBER' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Numeric Value Specification:</span>
                    {activeQuestion.validation && (
                      <span className="text-[11px] font-mono text-slate-500">
                        Valid range: {activeQuestion.validation.minNumeric ?? 0} to {activeQuestion.validation.maxNumeric ?? '∞'}
                      </span>
                    )}
                  </div>

                  {activeQuestion.options?.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {activeQuestion.options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setNumberVal(opt.value);
                            handleSaveAnswer(Number(opt.value));
                          }}
                          className={`p-2.5 rounded-lg border text-center text-xs font-semibold transition-colors cursor-pointer ${
                            String(activeQuestion.answer) === opt.value
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <div className="relative flex-1">
                      <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="number"
                        min={activeQuestion.validation?.minNumeric}
                        max={activeQuestion.validation?.maxNumeric}
                        placeholder="Enter numerical quantity..."
                        value={numberVal}
                        onChange={(e) => setNumberVal(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveNumber}
                      disabled={isSaving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      Save Number
                    </button>
                  </div>
                </div>
              )}

              {/* 4. RANGE RENDERER */}
              {activeQuestion.answerType === 'RANGE' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Specify Lower & Upper Range Bounds:</span>
                    {activeQuestion.validation && (
                      <span className="text-[11px] font-mono text-slate-500">
                        Bounds: {activeQuestion.validation.minNumeric} - {activeQuestion.validation.maxNumeric}
                      </span>
                    )}
                  </div>

                  {activeQuestion.options?.length > 0 && (
                    <div className="space-y-2">
                      {activeQuestion.options.map((opt) => {
                        const isSelected = activeQuestion.answer === opt.value;
                        return (
                          <div
                            key={opt.value}
                            onClick={() => {
                              const parts = opt.value.split('-');
                              setRangeMin(parts[0] || '');
                              setRangeMax(parts[1] || '');
                              handleSaveAnswer(opt.value);
                            }}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-50/60'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                              {opt.description && <p className="text-[11px] text-slate-500">{opt.description}</p>}
                            </div>
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                              {opt.value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Min Value:</label>
                      <input
                        type="number"
                        placeholder="Min"
                        value={rangeMin}
                        onChange={(e) => setRangeMin(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                    <span className="text-slate-400 font-bold pt-4">to</span>
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Max Value:</label>
                      <input
                        type="number"
                        placeholder="Max"
                        value={rangeMax}
                        onChange={(e) => setRangeMax(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={handleSaveRange}
                        disabled={isSaving}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                      >
                        Save Range
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. LONG_TEXT / FREE_TEXT RENDERER */}
              {(activeQuestion.answerType === 'LONG_TEXT' || activeQuestion.answerType === 'FREE_TEXT') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {activeQuestion.answerType === 'LONG_TEXT' ? 'Narrative Statement Specification:' : 'Textual Specification:'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{textVal.length} characters</span>
                  </div>

                  {activeQuestion.answerType === 'LONG_TEXT' ? (
                    <textarea
                      rows={5}
                      placeholder="Provide comprehensive narrative description or requirements statement..."
                      value={textVal}
                      onChange={(e) => setTextVal(e.target.value)}
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 leading-relaxed font-sans"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="Type statement here..."
                      value={textVal}
                      onChange={(e) => setTextVal(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                    />
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveAnswer(textVal.trim())}
                      disabled={isSaving || !textVal.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      Save Statement
                    </button>
                  </div>
                </div>
              )}

              {/* 6. DATE_OR_DURATION RENDERER */}
              {activeQuestion.answerType === 'DATE_OR_DURATION' && (
                <div className="space-y-4">
                  <span className="text-xs font-bold text-slate-700 block">Select Target Duration or Date SLA:</span>
                  {activeQuestion.options?.length > 0 && (
                    <div className="space-y-2">
                      {activeQuestion.options.map((opt) => {
                        const isSelected = activeQuestion.answer === opt.value;
                        return (
                          <div
                            key={opt.value}
                            onClick={() => {
                              setDurationVal(opt.value);
                              handleSaveAnswer(opt.value);
                            }}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-50/60'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                              {opt.description && <p className="text-[11px] text-slate-500">{opt.description}</p>}
                            </div>
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                              {opt.value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-3">
                    <div className="relative flex-1">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Custom duration (e.g. 2_hours, 14_days)..."
                        value={durationVal}
                        onChange={(e) => setDurationVal(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveAnswer(durationVal.trim())}
                      disabled={isSaving || !durationVal.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      Save Duration
                    </button>
                  </div>
                </div>
              )}

              {/* 7. KEY_VALUE_LIST RENDERER */}
              {activeQuestion.answerType === 'KEY_VALUE_LIST' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Environment Parameters & Key-Value Configuration:</span>
                    <button
                      type="button"
                      onClick={() => setKeyValuePairs([...keyValuePairs, { key: '', value: '' }])}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Parameter
                    </button>
                  </div>

                  <div className="space-y-2">
                    {keyValuePairs.map((pair, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="CONFIG_KEY (e.g. PORT)"
                          value={pair.key}
                          onChange={(e) => {
                            const updated = [...keyValuePairs];
                            updated[idx].key = e.target.value;
                            setKeyValuePairs(updated);
                          }}
                          className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 uppercase"
                        />
                        <input
                          type="text"
                          placeholder="Value (e.g. 3000)"
                          value={pair.value}
                          onChange={(e) => {
                            const updated = [...keyValuePairs];
                            updated[idx].value = e.target.value;
                            setKeyValuePairs(updated);
                          }}
                          className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (keyValuePairs.length > 1) {
                              setKeyValuePairs(keyValuePairs.filter((_, i) => i !== idx));
                            } else {
                              setKeyValuePairs([{ key: '', value: '' }]);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveKeyValue}
                      disabled={isSaving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              )}

              {/* 8. TECH_DECISION RENDERER */}
              {activeQuestion.answerType === 'TECH_DECISION' && (
                <div className="space-y-4">
                  <span className="text-xs font-bold text-slate-700 block">Select Technical Decision Mode:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTechMode('USER_SPECIFIED')}
                      className={`p-2.5 rounded-lg border text-center text-xs font-bold transition-colors cursor-pointer ${
                        techMode === 'USER_SPECIFIED'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      User Specified
                    </button>
                    <button
                      type="button"
                      onClick={() => setTechMode('RECOMMEND_FOR_ME')}
                      className={`p-2.5 rounded-lg border text-center text-xs font-bold transition-colors cursor-pointer ${
                        techMode === 'RECOMMEND_FOR_ME'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      Recommend For Me
                    </button>
                    <button
                      type="button"
                      onClick={() => setTechMode('UNKNOWN')}
                      className={`p-2.5 rounded-lg border text-center text-xs font-bold transition-colors cursor-pointer ${
                        techMode === 'UNKNOWN'
                          ? 'border-amber-600 bg-amber-50 text-amber-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      Unknown / Defer
                    </button>
                  </div>

                  {/* Mode: USER_SPECIFIED */}
                  {techMode === 'USER_SPECIFIED' && (
                    <div className="space-y-3 pt-2">
                      <span className="text-xs font-semibold text-slate-700 block">Select or Enter Technology:</span>
                      {activeQuestion.options?.map((opt) => {
                        const isSelected = activeQuestion.answer === opt.value;
                        return (
                          <div
                            key={opt.value}
                            onClick={() => {
                              setTechVal(opt.value);
                              handleSaveAnswer(opt.value);
                            }}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                              {opt.description && <p className="text-[11px] text-slate-500">{opt.description}</p>}
                            </div>
                            {isSelected && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {activeQuestion.allow_custom && (
                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="text"
                            placeholder="Specify custom runtime/toolchain..."
                            value={techVal}
                            onChange={(e) => setTechVal(e.target.value)}
                            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveAnswer(techVal.trim())}
                            disabled={!techVal.trim() || isSaving}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                          >
                            Save Selection
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode: RECOMMEND_FOR_ME */}
                  {techMode === 'RECOMMEND_FOR_ME' && (
                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-indigo-950">System Recommended Architectural Choice:</div>
                          <p className="text-xs text-indigo-900 mt-1">
                            {activeQuestion.options?.[0]?.label || 'No recommendation available; leave this decision open.'}
                          </p>
                          <p className="text-[11px] text-indigo-700 mt-1">
                            Candidate only. Review suitability for this project; acceptance is separate from architecture ratification.
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveAnswer({type:'RECOMMEND_FOR_ME',decision_mode:'RECOMMEND_FOR_ME',recommendation:{status:'ACCEPTED',preferredTechnology:activeQuestion.options?.[0]?.value},finalSelection:activeQuestion.options?.[0]?.value || null,status:'NOT_RATIFIED'})}
                          disabled={isSaving}
                          className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          Accept Selection (Not Ratified)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode: UNKNOWN */}
                  {techMode === 'UNKNOWN' && (
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertOctagon className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-amber-950">Decision Deferred Pending Discovery:</div>
                          <p className="text-xs text-amber-900 mt-1">
                            Technical selection will remain UNRESOLVED. Note: If this question is marked BLOCKING, advancement through the Architecture Phase Gate will require an explicit human override.
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveAnswer('undecided', 'DEFERRED')}
                          disabled={isSaving}
                          className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          Mark as Deferred
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 9. DEFAULT / SINGLE_SELECT RENDERER */}
              {(!activeQuestion.answerType || activeQuestion.answerType === 'SINGLE_SELECT') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 block">Select Solution Strategy:</span>
                    {activeQuestion.derivationRule && (
                      <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Auto-derives proposed artifacts
                      </span>
                    )}
                  </div>

                  {activeQuestion.options?.map((opt) => {
                    const isSelected = activeQuestion.answer === opt.value;
                    const rule = activeQuestion.derivationRule;
                    const producesArtifact =
                      rule &&
                      rule.triggerAnswerValues?.includes(opt.value) &&
                      (rule.producesRequirement || rule.producesFeature);

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSaveAnswer(opt.value)}
                        disabled={isSaving}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className={`text-xs md:text-sm font-semibold ${isSelected ? 'text-emerald-950' : 'text-slate-900'}`}>
                              {opt.label}
                            </div>
                            {opt.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                            )}
                            {producesArtifact && (
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-emerald-700 font-medium">
                                <span className="px-1.5 py-0.5 bg-emerald-100/70 rounded">
                                  Generates {rule.producesRequirement ? 'Requirement (PROPOSED)' : ''}
                                  {rule.producesRequirement && rule.producesFeature ? ' & ' : ''}
                                  {rule.producesFeature ? 'Feature' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded shrink-0">
                            Saved
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Decision Justification & Notes */}
              <div className="space-y-1.5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">
                    Decision Justification & Architecture Notes (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNaModalOpen(true)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5 text-slate-400" /> Mark Not Applicable
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="Record architectural reasoning or risk justification for this selection..."
                  value={customJustification}
                  onChange={(e) => setCustomJustification(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Navigation Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Previous
                </button>

                <button
                  onClick={() => setCurrentIndex(Math.min(filteredQuestions.length - 1, currentIndex + 1))}
                  disabled={currentIndex >= filteredQuestions.length - 1}
                  className="px-3.5 py-2 text-xs font-bold text-slate-800 hover:text-slate-950 disabled:opacity-30 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  Next Question <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No questions found for the selected domain or filter.
            </div>
          )}
        </div>

        {/* Right Readiness & Domain Breakdown Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Readiness Score Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Requirements Readiness</h3>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                {readinessPercent}%
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${readinessPercent}%` }}
              ></div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Answered / Resolved:</span>
                <span className="font-bold text-emerald-700">{resolvedCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Blocking Unresolved:</span>
                <span className="font-bold text-red-600">{blockingCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Deferred with Justification:</span>
                <span className="font-semibold text-slate-800">{deferredCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Not Applicable:</span>
                <span className="font-semibold text-slate-800">{naCount}</span>
              </div>
            </div>
          </div>

          {/* Domain Breakdown Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-400">
              Discovery Domain Coverage
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
              {domainStats.map((ds) => (
                <div
                  key={ds.domain}
                  onClick={() => {
                    setSelectedDomain(ds.domain);
                    setCurrentIndex(0);
                  }}
                  className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                    selectedDomain === ds.domain
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-800">{ds.meta.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {ds.answered} of {ds.total} completed
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        ds.percentage === 100
                          ? 'text-emerald-700'
                          : ds.blocking > 0
                          ? 'text-red-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {ds.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Blockers Override Card */}
          {blockingCount > 0 && (
            <div className="bg-red-50/70 rounded-xl border border-red-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-800 font-bold text-xs">
                <AlertOctagon className="w-4 h-4 text-red-600" />
                <span>{blockingCount} Blocking Items Pending</span>
              </div>
              <p className="text-xs text-red-700">
                A-SSDLC prevents advancement to Architecture until all blocking questions are answered or bypassed.
              </p>
              <button
                onClick={() => onOpenOverrideModal('DISCOVERY_PHASE_GATE')}
                className="w-full py-2 bg-white hover:bg-slate-50 text-red-700 font-bold text-xs rounded-lg border border-red-300 shadow-2xs transition-colors cursor-pointer"
              >
                Override Discovery Gate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* NOT APPLICABLE MODAL */}
      {isNaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Ban className="w-5 h-5 text-slate-500" />
              <span>Mark as Not Applicable</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Marking a discovery question as NOT APPLICABLE requires an explicit architectural or scope justification. This justification is permanently recorded in the project provenance trail.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Scope Justification (Mandatory):</label>
              <textarea
                rows={3}
                placeholder="e.g., Single-node local utility does not require distributed CRDT replication..."
                value={naJustification}
                onChange={(e) => setNaJustification(e.target.value)}
                className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-slate-800"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsNaModalOpen(false);
                  setNaJustification('');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkNotApplicable}
                disabled={!naJustification.trim() || isSaving}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Confirm Not Applicable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
