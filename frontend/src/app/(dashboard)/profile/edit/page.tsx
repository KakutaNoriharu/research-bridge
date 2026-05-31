"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { profileApi, ApiError } from "@/lib/api";
import type { CollaborationType } from "@/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// ── 定数 ─────────────────────────────────────────────────────────────────────

const RESEARCHER_COLLAB: { value: CollaborationType; label: string }[] = [
  { value: "joint_research", label: "共同研究" },
  { value: "commissioned_research", label: "受託研究" },
  { value: "consulting", label: "技術相談" },
];

const COMPANY_COLLAB: { value: CollaborationType; label: string }[] = [
  { value: "joint_research", label: "共同研究" },
  { value: "commissioned_research", label: "受託研究" },
  { value: "poc", label: "PoC" },
];

const EMPLOYEE_OPTIONS = [
  { value: "", label: "選択してください" },
  { value: "10", label: "1〜10人" },
  { value: "50", label: "11〜50人" },
  { value: "200", label: "51〜200人" },
  { value: "999", label: "201人以上" },
] as const;

function numToEmployeeValue(n: number | undefined): string {
  if (!n) return "";
  if (n <= 10) return "10";
  if (n <= 50) return "50";
  if (n <= 200) return "200";
  return "999";
}

// ── 小コンポーネント ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 border-b border-gray-100 pb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </p>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-medium text-gray-700">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </span>
  );
}

function Textarea({
  label,
  value,
  onChange,
  maxLength = 1000,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
}) {
  const remaining = maxLength - value.length;
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />
      <p className={`text-right text-xs ${remaining <= 50 ? "text-amber-500" : "text-gray-400"}`}>
        残り {remaining} 文字
      </p>
    </div>
  );
}

function TagInput({
  label,
  values,
  onChange,
  max = 10,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const isFull = values.length >= max;

  function add() {
    const v = draft.trim();
    if (v && !values.includes(v) && !isFull) {
      onChange([...values, v]);
    }
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-xs text-gray-400">{values.length}/{max}</span>
      </div>
      {!isFull && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder ?? "Enterで追加"}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          <Button type="button" variant="secondary" size="sm" onClick={add}>
            追加
          </Button>
        </div>
      )}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 rounded-full bg-primary-50 px-3 py-0.5 text-xs font-medium text-primary-700"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="ml-0.5 leading-none text-primary-400 hover:text-primary-700"
                aria-label={`${v}を削除`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CollabCheckboxes({
  options,
  values,
  onChange,
}: {
  options: { value: CollaborationType; label: string }[];
  values: CollaborationType[];
  onChange: (v: CollaborationType[]) => void;
}) {
  function toggle(type: CollaborationType) {
    onChange(
      values.includes(type) ? values.filter((v) => v !== type) : [...values, type],
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>連携形態</FieldLabel>
      <div className="flex flex-wrap gap-3">
        {options.map(({ value, label }) => (
          <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.includes(value)}
              onChange={() => toggle(value)}
              className="h-4 w-4 rounded border-gray-300 accent-primary-600"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-primary-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && (
          <span className="block text-xs text-gray-400">{description}</span>
        )}
      </span>
    </button>
  );
}

function LinkList({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  function update(i: number, val: string) {
    const next = [...values];
    next[i] = val;
    onChange(next);
  }
  function remove(i: number) {
    onChange(values.filter((_, j) => j !== i));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <FieldLabel>論文・実績リンク</FieldLabel>
        <span className="text-xs text-gray-400">{values.length}/5</span>
      </div>
      <div className="flex flex-col gap-2">
        {values.map((link, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="url"
              value={link}
              onChange={(e) => update(i, e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
              削除
            </Button>
          </div>
        ))}
        {values.length < 5 && (
          <button
            type="button"
            onClick={() => onChange([...values, ""])}
            className="flex w-fit items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-600"
          >
            <span className="text-base leading-none">+</span> 追加
          </button>
        )}
      </div>
    </div>
  );
}

function Toast({ onClose }: { onClose: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onClose, 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onClose]);

  return (
    <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 animate-[fadeInDown_0.2s_ease] rounded-xl bg-green-600 px-5 py-3 shadow-lg">
      <p className="flex items-center gap-2 text-sm font-medium text-white">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        プロフィールを更新しました
      </p>
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

export default function ProfileEditPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const token = session?.accessToken ?? "";
  const userId = session?.user?.id ?? "";

  // ページ状態
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showToast, setShowToast] = useState(false);

  // ── 研究者フィールド ──
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [lab, setLab] = useState("");
  const [position, setPosition] = useState("");
  const [researchSummary, setResearchSummary] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [publicationLinks, setPublicationLinks] = useState<string[]>([]);
  const [researcherCollab, setResearcherCollab] = useState<CollaborationType[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  // ── 企業フィールド ──
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [contactName, setContactName] = useState("");
  const [techNeeds, setTechNeeds] = useState("");
  const [desiredFields, setDesiredFields] = useState<string[]>([]);
  const [companyCollab, setCompanyCollab] = useState<CollaborationType[]>([]);

  const load = useCallback(async () => {
    if (!token || !userId || !role) return;
    setPageLoading(true);
    try {
      if (role === "researcher") {
        const p = await profileApi.getResearcher(userId, token);
        setName(p.name ?? "");
        setUniversity(p.university ?? "");
        setLab(p.lab ?? "");
        setPosition(p.position ?? "");
        setResearchSummary(p.research_summary ?? "");
        setKeywords(p.keywords ?? []);
        setTechStack(p.tech_stack ?? []);
        setPublicationLinks(p.publication_links ?? []);
        setResearcherCollab((p.collaboration_types ?? []) as CollaborationType[]);
        setIsPublic(p.is_public ?? true);
      } else {
        const p = await profileApi.getCompany(userId, token);
        setCompanyName(p.company_name ?? "");
        setIndustry(p.industry ?? "");
        setEmployeeCount(numToEmployeeValue(p.employee_count));
        setContactName(p.contact_name ?? "");
        setTechNeeds(p.tech_needs ?? "");
        setDesiredFields(p.desired_fields ?? []);
        setCompanyCollab((p.collaboration_types ?? []) as CollaborationType[]);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setIsNewProfile(true);
      }
    } finally {
      setPageLoading(false);
    }
  }, [token, userId, role]);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");

    try {
      if (role === "researcher") {
        const body = {
          name,
          university,
          lab: lab || null,
          position: position || null,
          research_summary: researchSummary || null,
          keywords,
          tech_stack: techStack,
          publication_links: publicationLinks.filter(Boolean),
          collaboration_types: researcherCollab,
          is_public: isPublic,
        };
        if (isNewProfile) {
          await profileApi.createResearcher(body, token);
          setIsNewProfile(false);
        } else {
          await profileApi.updateResearcher(body, token);
        }
      } else {
        const body = {
          company_name: companyName,
          industry: industry || null,
          employee_count: employeeCount ? parseInt(employeeCount) : null,
          contact_name: contactName,
          tech_needs: techNeeds || null,
          desired_fields: desiredFields,
          collaboration_types: companyCollab,
        };
        if (isNewProfile) {
          await profileApi.createCompany(body, token);
          setIsNewProfile(false);
        } else {
          await profileApi.updateCompany(body, token);
        }
      }
      setShowToast(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  // ── ローディング ──
  if (status === "loading" || pageLoading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3.5 w-24 rounded bg-gray-200" />
              <div className="h-9 rounded-lg bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {showToast && <Toast onClose={() => setShowToast(false)} />}

      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">プロフィール編集</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isNewProfile ? "プロフィールを新規作成します" : "プロフィール情報を更新します"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {role === "researcher" ? (
            <>
              {/* 基本情報 */}
              <div className="rounded-xl bg-white p-6 shadow-sm space-y-5">
                <SectionLabel>基本情報</SectionLabel>
                <Input
                  label="氏名"
                  required
                  placeholder="山田 太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="所属大学・機関"
                  placeholder="○○大学"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="研究室"
                    placeholder="○○研究室"
                    value={lab}
                    onChange={(e) => setLab(e.target.value)}
                  />
                  <Input
                    label="役職"
                    placeholder="准教授"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </div>
              </div>

              {/* 研究内容 */}
              <div className="rounded-xl bg-white p-6 shadow-sm space-y-5">
                <SectionLabel>研究内容</SectionLabel>
                <Textarea
                  label="研究概要"
                  value={researchSummary}
                  onChange={setResearchSummary}
                  placeholder="研究の概要・目的・成果などを記述してください"
                />
                <TagInput
                  label="研究キーワード"
                  values={keywords}
                  onChange={setKeywords}
                  max={10}
                  placeholder="例: 機械学習"
                />
                <TagInput
                  label="技術スタック"
                  values={techStack}
                  onChange={setTechStack}
                  max={10}
                  placeholder="例: Python, TensorFlow"
                />
                <LinkList values={publicationLinks} onChange={setPublicationLinks} />
              </div>

              {/* 連携設定 */}
              <div className="rounded-xl bg-white p-6 shadow-sm space-y-5">
                <SectionLabel>連携設定</SectionLabel>
                <CollabCheckboxes
                  options={RESEARCHER_COLLAB}
                  values={researcherCollab}
                  onChange={setResearcherCollab}
                />
                <ToggleSwitch
                  checked={isPublic}
                  onChange={setIsPublic}
                  label="プロフィールを公開する"
                  description="公開するとレコメンドに表示されます"
                />
              </div>
            </>
          ) : (
            <>
              {/* 企業情報 */}
              <div className="rounded-xl bg-white p-6 shadow-sm space-y-5">
                <SectionLabel>企業情報</SectionLabel>
                <Input
                  label="企業名"
                  required
                  placeholder="株式会社○○"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="業種"
                    placeholder="製造業"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel>従業員数</FieldLabel>
                    <select
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      {EMPLOYEE_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Input
                  label="担当者名"
                  placeholder="田中 花子"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>

              {/* 技術ニーズ */}
              <div className="rounded-xl bg-white p-6 shadow-sm space-y-5">
                <SectionLabel>技術ニーズ</SectionLabel>
                <Textarea
                  label="技術ニーズ・課題"
                  value={techNeeds}
                  onChange={setTechNeeds}
                  placeholder="解決したい技術課題や求めている研究成果を記述してください"
                />
                <TagInput
                  label="求める研究分野"
                  values={desiredFields}
                  onChange={setDesiredFields}
                  max={10}
                  placeholder="例: AI・機械学習"
                />
                <CollabCheckboxes
                  options={COMPANY_COLLAB}
                  values={companyCollab}
                  onChange={setCompanyCollab}
                />
              </div>
            </>
          )}

          {/* フッター */}
          {saveError && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {saveError}
            </p>
          )}

          <Button
            type="submit"
            disabled={saving}
            size="lg"
            className="w-full"
          >
            {saving ? "保存中..." : "保存する"}
          </Button>
        </form>
      </div>
    </>
  );
}
