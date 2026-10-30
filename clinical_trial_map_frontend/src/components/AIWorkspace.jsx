import { useEffect, useRef, useState } from "react";
import { BarChart3, LoaderCircle, Plus, Send, Sparkles, Table2, X } from "lucide-react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import TrialsTable from "./TrialsTable";
import ClinicalTrialMap from "./ClinicalTrialMap";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_URLS } from "../config/api";
import "./css/AIWorkspace.css";

const PAGE_SIZE = 20;
const PROMPT_GROUPS = [
  {
    title: "Find studies",
    description: "Search by disease, treatment, status, phase, or year.",
    prompts: [
      "Find recruiting Phase 3 lung cancer studies in Canada",
      "Show completed diabetes trials involving metformin",
      "Find studies with an exact start year of 2025",
    ],
  },
  {
    title: "Explore locations",
    description: "Narrow trials to a country or compare study activity by region.",
    prompts: [
      "Show active breast cancer studies in Germany",
      "Find recruiting diabetes trials in Japan",
    ],
  },
  {
    title: "Ask for insights",
    description: "Ask about counts, common phases, recruitment, or sponsors.",
    prompts: [
      "How many Phase 3 studies are there?",
      "What are the top sponsors for recruiting lung cancer studies in Canada?",
    ],
  },
];

function isGuidanceQuestion(question) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|help|what can you do(?: for me)?)\s*[!.?]*$/i.test(question.trim());
}

function PromptGroups({ onSelect, disabled }) {
  return (
    <div className="ai-workspace__prompt-groups">
      {PROMPT_GROUPS.map((group) => (
        <section className="ai-workspace__prompt-group" key={group.title}>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
          <div>
            {group.prompts.map((prompt) => (
              <button key={prompt} type="button" onClick={(event) => onSelect(event, prompt)} disabled={disabled}>
                {prompt}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DynamicAnalysisView({ analysis }) {
  if (!analysis) return null;
  return (
    <section className="ai-workspace__dynamic-analysis" aria-label={`Analysis by ${analysis.fieldLabel}`}>
      <h3>Trials by {analysis.fieldLabel}</h3>
      <p>
        {Number(analysis.analyzedTrials || 0).toLocaleString()} of {Number(analysis.totalMatchingTrials || 0).toLocaleString()} matching trials analyzed
        {analysis.complete ? " (complete)" : " (partial analysis)"}
      </p>
      {analysis.items?.length ? (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={analysis.items} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" interval="preserveStartEnd" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(value) => [Number(value || 0).toLocaleString(), "Trials"]} />
            <Bar dataKey="count" name="Trials" fill="#6366f1" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : <div className="ai-workspace__empty">No matching values were found.</div>}
    </section>
  );
}

function DynamicAnalysisTable({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="ai-workspace__analysis-table-wrap">
      <table className="ai-workspace__analysis-table">
        <thead><tr><th>{analysis.fieldLabel}</th><th>Matching trials</th></tr></thead>
        <tbody>
          {(analysis.items || []).map((item) => (
            <tr key={item.name}><td>{item.name}</td><td>{Number(item.count).toLocaleString()}</td></tr>
          ))}
        </tbody>
      </table>
      <p>{Number(analysis.analyzedTrials || 0).toLocaleString()} of {Number(analysis.totalMatchingTrials || 0).toLocaleString()} matching trials analyzed{analysis.complete ? "; complete." : "; partial analysis."}</p>
    </div>
  );
}
export default function AIWorkspace({ isActive, onSelectTrial }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [activeFilters, setActiveFilters] = useState({});
  const [result, setResult] = useState(null);
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("table");
  const [showResults, setShowResults] = useState(false);
  const [showViewTabs, setShowViewTabs] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsView, setAnalyticsView] = useState("charts");
  const [mapLocation, setMapLocation] = useState(null);
  const conversationEndRef = useRef(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function openMapLocation(trial, location) {
    setMapLocation({ trial, location });
  }

  function closeMapLocation() {
    setMapLocation(null);
  }

  useEffect(() => {
    if (!mapLocation) return undefined;
    function handleEscape(event) {
      if (event.key === "Escape") setMapLocation(null);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mapLocation]);

  async function loadAnalytics(filters) {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    setAnalyticsData(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && String(value).trim()) {
          params.set(key, String(value).trim());
        }
      });
      const response = await fetch(`${API_URLS.analytics}?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Analytics request failed: ${response.status}`);
      }
      setAnalyticsData(data);
      return data;
    } catch (requestError) {
      setAnalyticsError(requestError.message || "Unable to load analytics for this search.");
      return null;
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function sendMessage(event, suggestedQuestion) {
    event?.preventDefault();
    const submittedQuestion = (suggestedQuestion || question).trim();
    if (!submittedQuestion || loading) return;

    if (isGuidanceQuestion(submittedQuestion)) {
      const turnId = `${Date.now()}-${Math.random()}`;
      setQuestion("");
      setError("");
      setShowResults(false);
      setShowViewTabs(false);
      setMessages((current) => [
        ...current.map((message) => ({ ...message, showViewOptions: false })),
        { id: `${turnId}-user`, role: "user", content: submittedQuestion },
        {
          id: turnId,
          role: "assistant",
          content: "Hi! I can find studies, refine results by disease, drug, status, phase, country, or year, and summarize trial analytics. Choose a prompt below or ask in your own words.",
          showPrompts: true,
        },
      ]);
      return;
    }
    const answerId = `${Date.now()}-${Math.random()}`;
    setQuestion("");
    setError("");
    setLoading(true);
    setShowResults(false);
    setShowViewTabs(false);
    setAnalyticsData(null);
    setAnalyticsError("");
    setMessages((current) => [
      ...current.map((message) => ({ ...message, showViewOptions: false })),
      { id: `${answerId}-user`, role: "user", content: submittedQuestion },
      { id: answerId, role: "assistant", content: "Searching clinical trials...", pending: true },
    ]);

    try {
      const response = await fetch(API_URLS.aiSearch, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: submittedQuestion,
          pageSize: PAGE_SIZE,
          pageToken: "",
          contextFilters: activeFilters,
          conversationContext: result ? {
            question: result.question,
            task: result.queryPlan?.task,
            groupBy: result.queryPlan?.groupBy,
            rank: result.queryPlan?.rank,
            presentation: result.presentation,
          } : {},
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || `AI search failed: ${response.status}`);
      }

      const presentation = data.presentation || "count";
      const directView = ["graphical", "insights", "both"].includes(presentation)
        ? "graphical"
        : presentation === "table" ? "table" : "";
      setActiveFilters(data.interpretedFilters || {});
      setResult(data);
      setTrials(data.trials || []);
      setAnalyticsData(null);
      setAnalyticsError("");
      setView(directView || "table");
      setShowResults(Boolean(directView));
      setShowViewTabs(presentation === "both");
      setMessages((current) => current.map((message) => message.id === answerId
        ? { ...message, content: data.answer || "I could not produce an answer from the available trial data.", pending: false, showViewOptions: presentation === "count" && data.queryPlan?.task !== "unsupported" }
        : message));
    } catch {
      const message = "I could not complete that search. Please try again.";
      setError("");
      setMessages((current) => current.map((item) => item.id === answerId
        ? { ...item, content: message, pending: false, failed: true }
        : item));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!result?.nextPageToken || loading) return;
    setLoading(true);
    try {
      const response = await fetch(API_URLS.aiSearch, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: result.question,
          pageSize: PAGE_SIZE,
          pageToken: result.nextPageToken,
          contextFilters: result.interpretedFilters || activeFilters,
          conversationContext: {
            question: result.question,
            task: result.queryPlan?.task,
            groupBy: result.queryPlan?.groupBy,
            rank: result.queryPlan?.rank,
            presentation: result.presentation,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to load more studies.");
      setResult(data);
      setTrials((current) => [...current, ...(data.trials || [])]);
    } catch (requestError) {
      setError(requestError.message || "Unable to load more studies.");
    } finally {
      setLoading(false);
    }
  }

  function openResultView(nextView) {
    setView(nextView);
    setShowResults(true);
    if (nextView === "graphical" && result && !result.analysis && !analyticsData) {
      loadAnalytics(result.interpretedFilters || activeFilters);
    }
  }

  function startNewChat() {
    if (loading) return;
    setQuestion("");
    setMessages([]);
    setShowResults(false);
    setShowViewTabs(false);
    setActiveFilters({});
    setResult(null);
    setTrials([]);
    setAnalyticsData(null);
    setAnalyticsError("");
    setError("");
  }

  return (
    <>
      <section className="ai-workspace" aria-labelledby="ai-workspace-title" hidden={!isActive}>
      <header className="ai-workspace__heading">
        <div className="ai-workspace__heading-icon"><Sparkles size={21} /></div>
        <div>
          <span className="ai-workspace__eyebrow">AI RESEARCH WORKSPACE</span>
          <h1 id="ai-workspace-title">Conversational clinical insights</h1>
          <p>Ask a question, explore the findings, and refine your search in follow-up messages.</p>
        </div>
        <button className="ai-workspace__new-chat" type="button" onClick={startNewChat} disabled={loading}>
          <Plus size={16} /> New chat
        </button>
      </header>

      <div className="ai-workspace__conversation" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="ai-workspace__welcome">
            <span className="ai-workspace__welcome-icon"><Sparkles size={20} /></span>
            <div>
              <strong>What would you like to explore?</strong>
              <p>Choose a type of information or start with one of these prompts. You can ask a follow-up question anytime.</p>
            </div>
            <PromptGroups onSelect={sendMessage} disabled={loading} />
          </div>
        ) : messages.map((message) => (
          <article className={`ai-workspace__message ai-workspace__message--${message.role}`} key={message.id}>
            {message.role === "assistant" && <span className="ai-workspace__message-avatar"><Sparkles size={15} /></span>}
            <div className={`ai-workspace__message-bubble${message.failed ? " is-error" : ""}`}>
              <span className="ai-workspace__message-label">{message.role === "assistant" ? "Trial assistant" : "You"}</span>
              <p>{message.pending && <LoaderCircle className="ai-workspace__spinner" size={15} />}{message.content}</p>
              {message.showPrompts && <PromptGroups onSelect={sendMessage} disabled={loading} />}
              {message.showViewOptions && (
                <div className="ai-workspace__result-actions" aria-label="Explore matching studies">
                  <span>Explore these results</span>
                  <button type="button" aria-pressed={showResults && view === "table"} onClick={() => openResultView("table")}>
                    <Table2 size={15} /> View table
                  </button>
                  <button type="button" aria-pressed={showResults && view === "graphical"} onClick={() => openResultView("graphical")} disabled={analyticsLoading}>
                    <BarChart3 size={15} /> View graphs
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
        <div ref={conversationEndRef} />
      </div>

      <form className="ai-workspace__composer" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="ai-workspace-question">Ask about clinical trials</label>
        <textarea
          id="ai-workspace-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendMessage(event);
            }
          }}
          placeholder="Ask about studies, or refine your previous question..."
          maxLength={2000}
          rows={2}
          disabled={loading}
        />
        <div className="ai-workspace__composer-footer">
          <span>Enter to send | Shift + Enter for a new line</span>
          <button type="submit" disabled={loading || !question.trim()}>
            {loading ? <LoaderCircle className="ai-workspace__spinner" size={16} /> : <Send size={16} />}
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>

      {error && <div className="ai-workspace__error" role="alert">{error}</div>}

      {result && showResults && (
        <section className="ai-workspace__output" aria-label="Latest search results">
          <div className="ai-workspace__output-heading">
            <div>
              <span className="ai-workspace__eyebrow">LATEST RESULTS</span>
              <h2>{Number(result.totalCount || 0).toLocaleString()} matching studies</h2>
              <p className="ai-workspace__question">{result.question}</p>
            </div>
          </div>
          {showViewTabs && (
            <div className="ai-workspace__tabs" role="tablist" aria-label="Search result view">
              <button type="button" role="tab" aria-selected={view === "graphical"} className={view === "graphical" ? "active" : ""} onClick={() => setView("graphical")}>
                <BarChart3 size={16} /> Graphical
              </button>
              <button type="button" role="tab" aria-selected={view === "table"} className={view === "table" ? "active" : ""} onClick={() => setView("table")}>
                <Table2 size={16} /> Table
              </button>
            </div>
          )}
          {view === "table" ? (
            result.analysis ? <DynamicAnalysisTable analysis={result.analysis} /> : (
              <TrialsTable
                error=""
                loading={loading}
                hasSearched
                trials={trials}
                totalCount={result.totalCount || 0}
                nextPageToken={result.nextPageToken}
                onNextPage={loadMore}
                onSelectTrial={onSelectTrial}
                onOpenLocation={openMapLocation}
                showOfficialSite
              />
            )
          ) : result.analysis ? (
            <DynamicAnalysisView analysis={result.analysis} />
          ) : (
            <AnalyticsDashboard
              data={analyticsData}
              loading={analyticsLoading}
              error={analyticsError}
              view={analyticsView}
              onViewChange={setAnalyticsView}
              filters={result.interpretedFilters || {}}
            />
          )}
        </section>
      )}
    </section>
      {isActive && mapLocation && (
        <div className="ai-workspace__map-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeMapLocation();
        }}>
          <section className="ai-workspace__map-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-map-dialog-title">
            <header className="ai-workspace__map-dialog-heading">
              <div>
                <span className="ai-workspace__eyebrow">STUDY LOCATION</span>
                <h2 id="ai-map-dialog-title">{[mapLocation.location.city, mapLocation.location.country].filter(Boolean).join(", ") || mapLocation.location.facility || "Clinical trial site"}</h2>
                <p>{mapLocation.trial.title || mapLocation.trial.nctId}</p>
              </div>
              <button type="button" onClick={closeMapLocation} aria-label="Close map">
                <X size={19} />
              </button>
            </header>
            <div className="ai-workspace__map-dialog-content">
              <ClinicalTrialMap
                key={`${mapLocation.trial.nctId}-${mapLocation.location.latitude}-${mapLocation.location.longitude}`}
                mapData={null}
                trials={[{ ...mapLocation.trial, locations: [mapLocation.location] }]}
                onSelectTrial={(trial) => {
                  closeMapLocation();
                  onSelectTrial(trial);
                }}
                clusterDetailsUrl={`${API_URLS.map}/cluster-details`}
                filters={activeFilters}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}