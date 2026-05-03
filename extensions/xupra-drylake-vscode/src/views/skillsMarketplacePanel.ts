import * as vscode from "vscode";

import type { ApiClient } from "../services/apiClient";
import type { MarketplaceClient, V1Skill } from "../services/marketplaceClient";
import { ensureVersionSelection } from "../services/selection";
import type { StateStore } from "../services/stateStore";

type InboundMessage =
  | {
      type: "loadTrending";
      requestId: string;
      page?: number;
    }
  | {
      type: "loadCurated";
      requestId: string;
    }
  | {
      type: "search";
      requestId: string;
      q: string;
    }
  | {
      type: "loadSkillDetail";
      requestId: string;
      id: string;
    }
  | {
      type: "importSkill";
      requestId: string;
      id: string;
      skillName: string;
      installUrl: string | null;
    }
  | {
      type: "installViaCli";
      requestId: string;
      installUrl: string;
    };

type OutboundMessage =
  | {
      type: "result";
      requestId: string;
      result?: unknown;
    }
  | {
      type: "error";
      requestId: string;
      message: string;
    };

export class SkillsMarketplacePanel {
  private static currentPanel: SkillsMarketplacePanel | undefined;

  private readonly _disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly _panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly marketplaceClient: MarketplaceClient,
    private readonly apiClient: ApiClient,
    private readonly stateStore: StateStore,
  ) {
    this._panel.webview.html = this._getHtml();
    this._setupMessageHandler();
    this._panel.onDidDispose(
      () => {
        SkillsMarketplacePanel.currentPanel = undefined;
        this.dispose();
      },
      null,
      this._disposables,
    );
  }

  static createOrShow(
    context: vscode.ExtensionContext,
    marketplaceClient: MarketplaceClient,
    apiClient: ApiClient,
    stateStore: StateStore,
  ) {
    if (SkillsMarketplacePanel.currentPanel) {
      SkillsMarketplacePanel.currentPanel._panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "xupra.skillsMarketplace",
      "Browse Skills — skills.sh",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    SkillsMarketplacePanel.currentPanel = new SkillsMarketplacePanel(
      panel,
      context,
      marketplaceClient,
      apiClient,
      stateStore,
    );
  }

  private _setupMessageHandler() {
    this._panel.webview.onDidReceiveMessage(
      async (message: InboundMessage) => {
        try {
          switch (message.type) {
            case "loadTrending": {
              const page = typeof message.page === "number" ? message.page : 0;
              const result = await this.marketplaceClient.listSkills("trending", page);
              await this._postResult(message.requestId, {
                ...result,
                data: this._filterDuplicates(result.data),
              });
              break;
            }
            case "loadCurated": {
              const result = await this.marketplaceClient.getCuratedSkills();
              const filteredData = result.data
                .map((ownerGroup) => ({
                  ...ownerGroup,
                  skills: this._filterDuplicates(ownerGroup.skills ?? []),
                }))
                .filter((ownerGroup) => ownerGroup.skills.length > 0);
              await this._postResult(message.requestId, { ...result, data: filteredData });
              break;
            }
            case "search": {
              const result = await this.marketplaceClient.searchSkills(message.q);
              await this._postResult(message.requestId, {
                ...result,
                data: this._filterDuplicates(result.data),
              });
              break;
            }
            case "loadSkillDetail": {
              const [{ skill }, { audits }] = await Promise.all([
                this.marketplaceClient.getSkillDetail(message.id),
                this.marketplaceClient.getSkillAudits(message.id),
              ]);
              await this._postResult(message.requestId, { skill, audits });
              break;
            }
            case "importSkill": {
              await this._importSkill(message);
              break;
            }
            case "installViaCli": {
              const terminal = vscode.window.createTerminal({ name: "skills.sh" });
              terminal.show();
              terminal.sendText("npx skills add " + message.installUrl, false);
              await this._postResult(message.requestId, { ok: true });
              break;
            }
          }
        } catch (error) {
          const outbound: OutboundMessage = {
            type: "error",
            requestId: message.requestId,
            message: error instanceof Error ? error.message : String(error),
          };
          await this._panel.webview.postMessage(outbound);
        }
      },
      null,
      this._disposables,
    );
  }

  private async _importSkill(message: Extract<InboundMessage, { type: "importSkill" }>) {
    const connection = this.stateStore.getConnection();

    if (!connection.userEmail) {
      const errorMessage = "Connect Xupra first to import skills.";
      void vscode.window.showInformationMessage(errorMessage);
      await this._postError(message.requestId, errorMessage);
      return;
    }

    const selection = await ensureVersionSelection(this.apiClient, this.stateStore);

    if (!selection?.versionId) {
      await this._postError(message.requestId, "Choose a Xupra import target first.");
      return;
    }

    const { skill } = await this.marketplaceClient.getSkillDetail(message.id);
    const files = (skill.files ?? []).map((file) => ({
      logicalPath: file.path,
      content: file.contents,
    }));

    if (files.length === 0) {
      await this._postError(message.requestId, "This skill does not include importable files.");
      return;
    }

    await this.apiClient.uploadFiles(selection.versionId, files);
    await this.apiClient.importVersion(selection.versionId);
    void vscode.window.showInformationMessage(`'${message.skillName}' imported to your Xupra workspace.`);
    void vscode.commands.executeCommand("xupra.refreshProjects");
    await this._postResult(message.requestId, { ok: true });
  }

  private _filterDuplicates(skills: V1Skill[]) {
    return skills.filter((skill) => skill.isDuplicate !== true);
  }

  private async _postResult(requestId: string, result?: unknown) {
    const outbound: OutboundMessage = {
      type: "result",
      requestId,
      result,
    };
    await this._panel.webview.postMessage(outbound);
  }

  private async _postError(requestId: string, message: string) {
    const outbound: OutboundMessage = {
      type: "error",
      requestId,
      message,
    };
    await this._panel.webview.postMessage(outbound);
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    button,
    input {
      font: inherit;
    }

    .shell {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      height: 100vh;
      min-height: 0;
    }

    .tabs {
      display: flex;
      gap: 2px;
      padding: 10px 12px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }

    .tab {
      padding: 7px 12px;
      color: var(--vscode-foreground);
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      cursor: pointer;
    }

    .tab.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border-radius: 4px 4px 0 0;
    }

    .search-row {
      display: none;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .search-row.visible {
      display: grid;
    }

    .search-input {
      min-width: 0;
      padding: 7px 9px;
      color: var(--vscode-input-foreground, var(--vscode-foreground));
      background: var(--vscode-input-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
    }

    .primary-btn,
    .secondary-btn {
      padding: 7px 10px;
      border-radius: 4px;
      cursor: pointer;
    }

    .primary-btn {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 1px solid var(--vscode-button-background);
    }

    .secondary-btn {
      color: var(--vscode-foreground);
      background: transparent;
      border: 1px solid var(--vscode-panel-border);
    }

    .primary-btn:disabled,
    .secondary-btn:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .content {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) minmax(320px, 0.82fr);
      min-height: 0;
    }

    .list-pane {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      border-right: 1px solid var(--vscode-panel-border);
    }

    .detail-pane {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      background: var(--vscode-editor-background);
    }

    .detail-pane.hidden {
      display: none;
    }

    .skills-list,
    .detail-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
    }

    .group-title {
      margin: 8px 0 0;
      padding-bottom: 4px;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 0.9em;
      font-weight: 650;
    }

    .skill-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px 12px;
      width: 100%;
      padding: 10px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
    }

    .skill-card:hover,
    .skill-card.selected {
      border-color: var(--vscode-button-background);
    }

    .skill-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 650;
    }

    .skill-source,
    .skill-installs,
    .muted {
      color: var(--vscode-descriptionForeground);
    }

    .skill-source {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .skill-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      grid-column: 1 / -1;
      font-size: 0.92em;
    }

    .audit-badge {
      align-self: start;
      padding: 2px 7px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 0.82em;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .audit-badge.pass {
      color: var(--vscode-testing-iconPassed, #8fd694);
      background: var(--vscode-diffEditor-insertedLineBackground, rgba(46, 160, 67, 0.14));
      border-color: var(--vscode-diffEditor-insertedLineBorderColor, rgba(46, 160, 67, 0.45));
    }

    .audit-badge.warn {
      color: var(--vscode-testing-iconQueued, #f2cc60);
      background: var(--vscode-inputValidation-warningBackground, rgba(210, 153, 34, 0.15));
      border-color: var(--vscode-inputValidation-warningBorder, rgba(210, 153, 34, 0.5));
    }

    .audit-badge.fail {
      color: var(--vscode-testing-iconFailed, #ff9b9b);
      background: var(--vscode-inputValidation-errorBackground, rgba(218, 54, 51, 0.15));
      border-color: var(--vscode-inputValidation-errorBorder, rgba(218, 54, 51, 0.5));
    }

    .empty-state,
    .status-line {
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
    }

    .error-line {
      padding: 8px 10px;
      color: var(--vscode-errorForeground, #ffb4b4);
      background: var(--vscode-inputValidation-errorBackground, rgba(218, 54, 51, 0.13));
      border: 1px solid var(--vscode-inputValidation-errorBorder, rgba(218, 54, 51, 0.45));
      border-radius: 5px;
    }

    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .detail-title {
      margin: 0 0 4px;
      font-size: 1.25em;
      font-weight: 700;
    }

    .detail-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .section-title {
      margin: 4px 0 0;
      font-weight: 650;
    }

    pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      color: var(--vscode-foreground);
      background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .audit-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .audit-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 5px 8px;
      padding: 9px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
    }

    .audit-summary {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    @media (max-width: 760px) {
      .content {
        grid-template-columns: 1fr;
      }

      .list-pane {
        border-right: 0;
      }

      .detail-pane {
        border-top: 1px solid var(--vscode-panel-border);
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="tabs" role="tablist">
      <button class="tab active" data-tab="trending" type="button">Trending</button>
      <button class="tab" data-tab="curated" type="button">Curated</button>
      <button class="tab" data-tab="search" type="button">Search</button>
    </div>
    <div id="searchRow" class="search-row">
      <input id="searchInput" class="search-input" type="search" placeholder="Search skills.sh">
      <button id="searchButton" class="primary-btn" type="button">Search</button>
    </div>
    <div class="content">
      <div class="list-pane">
        <div id="statusLine" class="status-line" style="padding: 12px;">Loading trending skills...</div>
        <div id="errorLine" class="error-line" style="display: none; margin: 12px;"></div>
        <div id="skillList" class="skills-list"></div>
        <div id="paginationRow" style="display: none; padding: 10px 12px; border-top: 1px solid var(--vscode-panel-border); display: flex; align-items: center; gap: 8px;"></div>
      </div>
      <div id="detailPane" class="detail-pane hidden">
        <div id="detailContent" class="detail-content"></div>
      </div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const pending = new Map();
    const state = {
      activeTab: "trending",
      trending: [],
      trendingPage: 0,
      trendingHasMore: false,
      trendingTotal: 0,
      curated: [],
      curatedRaw: null,
      search: [],
      selectedSkill: null,
      selectedDetail: null,
      selectedAudits: [],
      loaded: {
        trending: false,
        curated: false
      }
    };

    function uuid() {
      if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }

      return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function request(type, payload) {
      const requestId = uuid();

      return new Promise(function(resolve, reject) {
        pending.set(requestId, { resolve, reject });
        vscode.postMessage(Object.assign({}, payload || {}, { type, requestId }));
      });
    }

    function setStatus(message) {
      const statusLine = document.getElementById("statusLine");
      if (!statusLine) {
        return;
      }

      statusLine.textContent = message || "";
      statusLine.style.display = message ? "block" : "none";
    }

    function setError(message) {
      const errorLine = document.getElementById("errorLine");
      if (!errorLine) {
        return;
      }

      errorLine.textContent = message || "";
      errorLine.style.display = message ? "block" : "none";
    }

    function formatInstalls(value) {
      const numberValue = Number(value || 0);
      return numberValue.toLocaleString();
    }

    function auditStatusForSkill(skill) {
      const raw = skill && (skill.auditStatus || (skill.audit && skill.audit.status) || skill.status);
      const normalized = String(raw || "none").toLowerCase();
      return normalized === "pass" || normalized === "warn" || normalized === "fail" ? normalized : "none";
    }

    function auditStatusForAudits(audits) {
      const statuses = (Array.isArray(audits) ? audits : []).map(function(audit) {
        return String(audit.status || "").toLowerCase();
      });

      if (statuses.includes("fail")) {
        return "fail";
      }

      if (statuses.includes("warn")) {
        return "warn";
      }

      if (statuses.includes("pass")) {
        return "pass";
      }

      return "none";
    }

    function auditBadge(status) {
      const normalized = status === "pass" || status === "warn" || status === "fail" ? status : "none";
      const label = normalized === "none" ? "No audit" : normalized;
      return '<span class="audit-badge ' + normalized + '">' + escapeHtml(label) + '</span>';
    }

    function normalizeSkills(result) {
      if (!result || !Array.isArray(result.data) || result.data.length === 0) {
        return [];
      }

      const firstItem = result.data[0];
      if (firstItem && typeof firstItem.id === "string") {
        return result.data;
      }

      if (firstItem && Array.isArray(firstItem.skills)) {
        return result.data.flatMap(function(ownerGroup) {
          return Array.isArray(ownerGroup.skills) ? ownerGroup.skills : [];
        });
      }

      return [];
    }

    function groupBySource(skills) {
      return (Array.isArray(skills) ? skills : []).reduce(function(groups, skill) {
        const source = skill.source || "Unknown source";
        if (!groups[source]) {
          groups[source] = [];
        }

        groups[source].push(skill);
        return groups;
      }, {});
    }

    function findSkill(id) {
      const allSkills = state.trending.concat(state.curated, state.search);
      return allSkills.find(function(skill) {
        return skill.id === id;
      }) || null;
    }

    function skillCard(skill) {
      const isSelected = state.selectedSkill && state.selectedSkill.id === skill.id;
      const classes = isSelected ? "skill-card selected" : "skill-card";
      return '<button class="' + classes + '" type="button" data-skill-id="' + escapeHtml(skill.id) + '">'
        + '<span class="skill-name" title="' + escapeHtml(skill.name) + '">' + escapeHtml(skill.name || skill.slug || skill.id) + '</span>'
        + '<span class="skill-meta"><span class="skill-source" title="' + escapeHtml(skill.source) + '">' + escapeHtml(skill.source || "Unknown source") + '</span>'
        + '<span class="skill-installs">' + formatInstalls(skill.installs) + ' installs</span></span>'
        + '</button>';
    }

    function renderSkillList() {
      const list = document.getElementById("skillList");
      if (!list) {
        return;
      }

      const skills = state[state.activeTab] || [];
      if (state.activeTab === "curated") {
        if (state.curatedRaw && Array.isArray(state.curatedRaw.data)) {
          list.innerHTML = state.curatedRaw.data.map(function(ownerGroup) {
            const ownerSkills = Array.isArray(ownerGroup.skills) ? ownerGroup.skills : [];
            return '<div class="group-title">' + escapeHtml(ownerGroup.owner || "Unknown owner") + '</div>'
              + ownerSkills.map(skillCard).join("");
          }).join("");
        } else {
          list.innerHTML = '<div class="empty-state">No skills found.</div>';
        }
        return;
      }

      if (skills.length === 0) {
        const emptyText = state.activeTab === "search"
          ? "Search for a skill to get started."
          : "No skills found.";
        list.innerHTML = '<div class="empty-state">' + escapeHtml(emptyText) + '</div>';
        return;
      }

      list.innerHTML = skills.map(skillCard).join("");
    }

    function renderPagination() {
      const paginationRow = document.getElementById("paginationRow");
      if (!paginationRow) {
        return;
      }

      if (state.activeTab !== "trending") {
        paginationRow.style.display = "none";
        return;
      }

      paginationRow.style.display = "flex";
      paginationRow.innerHTML = '<span>Page ' + escapeHtml(state.trendingPage + 1) + '</span>'
        + '<button class="secondary-btn" type="button" data-action="prevPage" ' + (state.trendingPage === 0 ? "disabled" : "") + '>Previous</button>'
        + '<button class="secondary-btn" type="button" data-action="nextPage" ' + (!state.trendingHasMore ? "disabled" : "") + '>Next</button>';
    }

    function skillMarkdownFile(files) {
      const list = Array.isArray(files) ? files : [];
      const skillFile = list.find(function(file) {
        return String(file.path || "").toLowerCase().endsWith("skill.md");
      });

      return skillFile || list[0] || null;
    }

    function renderAudits(audits) {
      if (!Array.isArray(audits) || audits.length === 0) {
        return '<div class="muted">No audit results are available for this skill.</div>';
      }

      return '<ul class="audit-list">' + audits.map(function(audit) {
        const risk = audit.riskLevel ? ' · ' + escapeHtml(audit.riskLevel) : "";
        const date = audit.auditedAt ? ' · ' + escapeHtml(audit.auditedAt) : "";
        return '<li class="audit-item">'
          + auditBadge(audit.status)
          + '<div class="audit-summary"><strong>' + escapeHtml(audit.provider || audit.slug || "Audit") + '</strong>'
          + '<div>' + escapeHtml(audit.summary || "") + '</div>'
          + '<div class="muted">' + escapeHtml(audit.slug || "") + risk + date + '</div></div>'
          + '</li>';
      }).join("") + '</ul>';
    }

    function renderDetailLoading(skill) {
      const detailPane = document.getElementById("detailPane");
      const detailContent = document.getElementById("detailContent");
      if (!detailPane || !detailContent) {
        return;
      }

      detailPane.classList.remove("hidden");
      detailContent.innerHTML = '<div class="detail-header"><div><h2 class="detail-title">' + escapeHtml(skill.name || skill.slug || skill.id) + '</h2>'
        + '<div class="muted">' + escapeHtml(skill.source || "") + '</div></div>'
        + '</div>'
        + '<div class="status-line">Loading skill details...</div>';
    }

    function renderDetail() {
      const detailPane = document.getElementById("detailPane");
      const detailContent = document.getElementById("detailContent");
      if (!detailPane || !detailContent || !state.selectedSkill || !state.selectedDetail) {
        return;
      }

      const skill = state.selectedSkill;
      const detail = state.selectedDetail;
      const markdownFile = skillMarkdownFile(detail.files);
      const installUrl = skill.installUrl || detail.installUrl || null;
      const auditStatus = auditStatusForAudits(state.selectedAudits);
      detailPane.classList.remove("hidden");
      detailContent.innerHTML = '<div class="detail-header"><div><h2 class="detail-title">' + escapeHtml(skill.name || detail.slug || detail.id) + '</h2>'
        + '<div class="muted">' + escapeHtml(detail.source || skill.source || "") + ' · ' + formatInstalls(detail.installs || skill.installs) + ' installs</div></div>'
        + auditBadge(auditStatus) + '</div>'
        + '<div class="detail-actions">'
        + '<button class="primary-btn" type="button" data-action="importSkill">Import to Xupra</button>'
        + '<button class="secondary-btn" type="button" data-action="installViaCli" ' + (installUrl ? "" : "disabled") + '>Install via CLI</button>'
        + '</div>'
        + '<div class="section-title">SKILL.md</div>'
        + '<pre>' + escapeHtml(markdownFile ? markdownFile.contents : "No SKILL.md content was returned for this skill.") + '</pre>'
        + '<div class="section-title">Audit Results</div>'
        + renderAudits(state.selectedAudits);
    }

    function setActiveTab(tab) {
      state.activeTab = tab;
      document.querySelectorAll("[data-tab]").forEach(function(button) {
        button.classList.toggle("active", button.dataset.tab === tab);
      });

      const searchRow = document.getElementById("searchRow");
      if (searchRow) {
        searchRow.classList.toggle("visible", tab === "search");
      }

      renderPagination();
      setError("");
      renderSkillList();

      if (tab === "trending" && !state.loaded.trending) {
        loadTrending();
      }

      if (tab === "curated" && !state.loaded.curated) {
        loadCurated();
      }
    }

    async function loadTrending(page) {
      const pageNum = typeof page === "number" ? page : 0;
      setStatus("Loading trending skills...");
      setError("");

      try {
        const result = await request("loadTrending", { page: pageNum });
        state.trending = normalizeSkills(result);
        state.trendingPage = result && result.pagination ? result.pagination.page : pageNum;
        state.trendingHasMore = result && result.pagination ? result.pagination.hasMore : false;
        state.trendingTotal = result && result.pagination ? result.pagination.total : 0;
        state.loaded.trending = true;
        setStatus("");
        renderSkillList();
        renderPagination();
      } catch (error) {
        setStatus("");
        setError(error.message || String(error));
      }
    }

    async function loadCurated() {
      setStatus("Loading curated skills...");
      setError("");

      try {
        const result = await request("loadCurated");
        state.curatedRaw = result;
        state.curated = normalizeSkills(result);
        state.loaded.curated = true;
        setStatus("");
        renderSkillList();
      } catch (error) {
        setStatus("");
        setError(error.message || String(error));
      }
    }

    async function runSearch() {
      const input = document.getElementById("searchInput");
      const q = input ? input.value.trim() : "";
      if (!q) {
        state.search = [];
        renderSkillList();
        return;
      }

      setStatus("Searching skills...");
      setError("");

      try {
        const result = await request("search", { q });
        state.search = normalizeSkills(result);
        setStatus("");
        renderSkillList();
      } catch (error) {
        setStatus("");
        setError(error.message || String(error));
      }
    }

    async function loadSkillDetail(id) {
      const skill = findSkill(id);
      if (!skill) {
        return;
      }

      state.selectedSkill = skill;
      state.selectedDetail = null;
      state.selectedAudits = [];
      renderSkillList();
      renderDetailLoading(skill);
      setError("");

      try {
        const result = await request("loadSkillDetail", { id });
        state.selectedDetail = result.skill;
        state.selectedAudits = Array.isArray(result.audits) ? result.audits : [];
        renderDetail();
      } catch (error) {
        setError(error.message || String(error));
      }
    }

    async function importSkill() {
      if (!state.selectedSkill) {
        return;
      }

      const installUrl = state.selectedSkill.installUrl || null;
      setError("");

      try {
        await request("importSkill", {
          id: state.selectedSkill.id,
          skillName: state.selectedSkill.name || state.selectedSkill.slug || state.selectedSkill.id,
          installUrl
        });
      } catch (error) {
        setError(error.message || String(error));
      }
    }

    async function installViaCli() {
      if (!state.selectedSkill || !state.selectedSkill.installUrl) {
        return;
      }

      setError("");

      try {
        await request("installViaCli", { installUrl: state.selectedSkill.installUrl });
      } catch (error) {
        setError(error.message || String(error));
      }
    }

    window.addEventListener("message", function(event) {
      const message = event.data || {};
      if (!message.requestId || !pending.has(message.requestId)) {
        return;
      }

      const handlers = pending.get(message.requestId);
      pending.delete(message.requestId);

      if (message.type === "result") {
        handlers.resolve(message.result);
        return;
      }

      handlers.reject(new Error(message.message || "Request failed."));
    });

    document.addEventListener("click", function(event) {
      const tab = event.target.closest("[data-tab]");
      if (tab) {
        setActiveTab(tab.dataset.tab);
        return;
      }

      const card = event.target.closest("[data-skill-id]");
      if (card) {
        loadSkillDetail(card.dataset.skillId);
        return;
      }

      const action = event.target.closest("[data-action]");
      if (!action) {
        return;
      }

      if (action.dataset.action === "importSkill") {
        importSkill();
      }

      if (action.dataset.action === "installViaCli") {
        installViaCli();
      }

      if (action.dataset.action === "prevPage") {
        loadTrending(state.trendingPage - 1);
      }

      if (action.dataset.action === "nextPage") {
        loadTrending(state.trendingPage + 1);
      }
    });

    document.getElementById("searchButton").addEventListener("click", runSearch);
    document.getElementById("searchInput").addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        runSearch();
      }
    });

    loadTrending();
  </script>
</body>
</html>`;
  }

  dispose() {
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
