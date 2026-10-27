import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorBox } from "../components/ErrorBox.js";
import { Icon } from "../components/Icon.js";
import { Modal } from "../components/Modal.js";
import { useNotify } from "../components/Notification.js";
import { PageHeader } from "../components/PageHeader.js";
import { AskView, CodeView, FileView, ImageView, SolveView } from "../components/Results.js";
import type { MessageKey } from "../i18n/dictionary.js";
import { useI18n } from "../i18n/I18nProvider.js";
import {
  type AskResult,
  type CodeResult,
  type FileResult,
  type HistoryEntry,
  type ImageResult,
  type SolveResult,
  TOOL_TYPES,
  type ToolType,
} from "../models/index.js";
import { type HistoryDetail, type HistoryFilter, historyService } from "../services/index.js";
import { TYPE_ICON } from "./DashboardPage.js";

export function HistoryDetailView({ detail }: { detail: HistoryDetail }) {
  switch (detail.type) {
    case "ask":
      return <AskView messageId={detail.id} result={detail.result as AskResult} />;
    case "solve":
      return <SolveView messageId={detail.id} result={detail.result as SolveResult} />;
    case "code":
      return <CodeView messageId={detail.id} result={detail.result as CodeResult} />;
    case "file":
      return <FileView messageId={detail.id} result={detail.result as FileResult} />;
    case "image":
      return <ImageView messageId={detail.id} result={detail.result as ImageResult} />;
  }
}

export function HistoryPage() {
  const { t, language } = useI18n();
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<HistoryFilter>({ q: "", type: "", sort: "newest", page: 1, limit: 10 });
  const [data, setData] = useState<{ items: HistoryEntry[]; total: number } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [toDelete, setToDelete] = useState<HistoryEntry | null>(null);

  const load = useCallback(() => {
    setError(null);
    historyService
      .list(filter)
      .then(setData)
      .catch(setError);
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const open = useCallback(
    async (id: string) => {
      try {
        setDetail(await historyService.get(id));
        setParams({ open: id }, { replace: true });
      } catch (e) {
        setError(e);
      }
    },
    [setParams],
  );

  useEffect(() => {
    const id = params.get("open");
    if (id && !detail) void open(id);
  }, [params, detail, open]);

  const closeDetail = () => {
    setDetail(null);
    setParams({}, { replace: true });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await historyService.remove(toDelete.id);
      notify(t("history.deleted"));
      setToDelete(null);
      load();
    } catch (e) {
      setError(e);
      setToDelete(null);
    }
  };

  const toggleSaved = async (item: HistoryEntry) => {
    await historyService.setSaved(item.id, !item.saved).catch(setError);
    load();
  };

  const set = (patch: HistoryFilter) => setFilter((f) => ({ ...f, page: 1, ...patch }));
  const pages = data ? Math.max(1, Math.ceil(data.total / (filter.limit ?? 10))) : 1;
  const dateFmt = new Intl.DateTimeFormat(language === "kk" ? "kk-KZ" : language, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="tool-page">
      <PageHeader icon="history" lead={t("history.lead")} title={t("history.title")} />
      <div className="card filters">
        <label className="field grow">
          <span className="label">{t("history.search")}</span>
          <span className="input-icon">
            <Icon name="search" size={18} />
            <input onChange={(e) => set({ q: e.target.value })} type="search" value={filter.q} />
          </span>
        </label>
        <label className="field">
          <span className="label">{t("history.tool")}</span>
          <select onChange={(e) => set({ type: e.target.value as ToolType | "" })} value={filter.type}>
            <option value="">{t("history.allTypes")}</option>
            {TOOL_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`type.${type}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{t("history.from")}</span>
          <input onChange={(e) => set({ from: e.target.value })} type="date" value={filter.from ?? ""} />
        </label>
        <label className="field">
          <span className="label">{t("history.to")}</span>
          <input onChange={(e) => set({ to: e.target.value })} type="date" value={filter.to ?? ""} />
        </label>
        <label className="field">
          <span className="label">{t("history.sort")}</span>
          <select onChange={(e) => set({ sort: e.target.value as "newest" | "oldest" })} value={filter.sort}>
            <option value="newest">{t("history.newest")}</option>
            <option value="oldest">{t("history.oldest")}</option>
          </select>
        </label>
        <label className="check">
          <input checked={Boolean(filter.saved)} onChange={(e) => set({ saved: e.target.checked })} type="checkbox" />
          {t("history.savedOnly")}
        </label>
      </div>

      {error ? <ErrorBox error={error} onRetry={load} /> : null}

      {data && data.items.length === 0 && <p className="card empty">{t("history.empty")}</p>}
      {data && data.items.length > 0 && (
        <ul className="history-list">
          {data.items.map((item) => (
            <li className="card history-item" key={item.id}>
              <span className={`type-icon type-${item.type}`}>
                <Icon name={TYPE_ICON[item.type]} size={18} />
              </span>
              <button className="history-main" onClick={() => open(item.id)} type="button">
                <strong>{item.prompt}</strong>
                <small>
                  {t(`type.${item.type}` as MessageKey)} · {dateFmt.format(new Date(item.createdAt))} · {item.language.toUpperCase()}
                  {item.sourceCount > 0 && ` · ${t("history.sources", { n: item.sourceCount })}`}
                </small>
              </button>
              <div className="history-actions">
                <button
                  aria-label={t("action.save")}
                  aria-pressed={item.saved}
                  className={`icon-btn ${item.saved ? "on" : ""}`}
                  onClick={() => toggleSaved(item)}
                  title={t("action.save")}
                  type="button"
                >
                  <Icon name="save" size={18} />
                </button>
                <button
                  aria-label={t("history.delete")}
                  className="icon-btn danger"
                  onClick={() => setToDelete(item)}
                  title={t("history.delete")}
                  type="button"
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > 0 && (
        <nav aria-label="pagination" className="pager">
          <button
            className="btn btn-ghost btn-sm"
            disabled={(filter.page ?? 1) <= 1}
            onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            type="button"
          >
            {t("history.prev")}
          </button>
          <span>{t("history.page", { page: filter.page ?? 1, total: data.total })}</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={(filter.page ?? 1) >= pages}
            onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            type="button"
          >
            {t("history.next")}
          </button>
        </nav>
      )}

      <Modal onClose={closeDetail} open={Boolean(detail)} title={detail?.prompt ?? ""}>
        {detail && <HistoryDetailView detail={detail} />}
      </Modal>
      <Modal
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setToDelete(null)} type="button">
              {t("action.cancel")}
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} type="button">
              {t("history.delete")}
            </button>
          </>
        }
        onClose={() => setToDelete(null)}
        open={Boolean(toDelete)}
        title={t("history.delete")}
      >
        <p>{t("history.confirmDelete")}</p>
        <p className="muted">{toDelete?.prompt}</p>
      </Modal>
    </div>
  );
}
