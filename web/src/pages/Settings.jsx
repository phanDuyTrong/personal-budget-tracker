import { GlassCard } from "@/components/ui";
import React, { useEffect, useState } from "react";
import {
  CheckIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  SwatchIcon,
  ComputerDesktopIcon,
  SunIcon,
  MoonIcon,
  LanguageIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@heroui/button";
import { Input as HeroInput } from "@heroui/input";
import { Select as HeroSelect, SelectItem } from "@heroui/select";
import { Tabs, Tab } from "@heroui/tabs";
import { Chip } from "@heroui/chip";
import { Card } from "@heroui/card";
import { Tooltip } from "@heroui/tooltip";
import { useSettingsStore, ACCENT_COLORS } from "@/stores/settingsStore";
import { useT } from "@/hooks/useTranslation";
import { useWallets } from "@/features/wallets/hooks";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/useToast";

function Section({ icon, title, description, children }) {
  const SectionIcon = icon;
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary shadow-inner">
          <SectionIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm font-medium text-neutral-500 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="pl-0 md:pl-16">{children}</div>
    </div>
  );
}

const NO_DEFAULT_WALLET = "__none__";

function walletSelectionKey(walletId) {
  return walletId || NO_DEFAULT_WALLET;
}

function selectedWalletValue(keys) {
  const key = Array.from(keys)[0] || NO_DEFAULT_WALLET;
  return key === NO_DEFAULT_WALLET ? "" : key;
}

function TelegramBotSettings() {
  const toast = useToast();
  const { data: wallets = [] } = useWallets();
  const [status, setStatus] = useState(null);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [weeklyAlertsEnabled, setWeeklyAlertsEnabled] = useState(true);
  const [weeklyAlertBudgetEnabled, setWeeklyAlertBudgetEnabled] = useState(true);
  const [weeklyAlertGoalEnabled, setWeeklyAlertGoalEnabled] = useState(true);
  const [weeklyAlertInactivityEnabled, setWeeklyAlertInactivityEnabled] = useState(false);
  const [weeklyAlertInactivityDays, setWeeklyAlertInactivityDays] = useState("7");
  const [linkCode, setLinkCode] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    const { data, error } = await supabase.functions.invoke("telegram-config", {
      body: { action: "status" },
    });
    if (error) throw error;
    setStatus(data?.link || null);
    if (data?.link?.default_wallet_id)
      setSelectedWalletId(data.link.default_wallet_id);
    else setSelectedWalletId("");
    setWeeklyAlertsEnabled(data?.link?.weekly_alerts_enabled !== false);
    setWeeklyAlertBudgetEnabled(data?.link?.weekly_alerts_budget_enabled !== false);
    setWeeklyAlertGoalEnabled(data?.link?.weekly_alerts_goal_enabled !== false);
    setWeeklyAlertInactivityEnabled(data?.link?.weekly_alerts_inactivity_enabled === true);
    setWeeklyAlertInactivityDays(String(data?.link?.weekly_alerts_inactivity_days || 7));
  };

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("telegram_transaction_templates")
      .select(
        "id,name,trigger_text,is_active,created_at,items:telegram_transaction_template_items(id,type,amount,description,sort_order,smart_config,wallet:wallets!wallet_id(id,name),to_wallet:wallets!to_wallet_id(id,name),category:categories(id,name))",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    setTemplates(
      (data || []).map((template) => ({
        ...template,
        items: [...(template.items || [])].sort(
          (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
        ),
      })),
    );
  };

  useEffect(() => {
    loadStatus().catch(() => {
      setStatus(null);
    });
    loadTemplates().catch(() => {
      setTemplates([]);
    });
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "telegram-config",
        {
          body: {
            action: "create_link_code",
            defaultWalletId: selectedWalletId || null,
          },
        },
      );
      if (error) throw error;
      setLinkCode(data);
      toast("Telegram link code created.", "success");
    } catch (error) {
      toast(error.message || "Could not create Telegram link code.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWallet = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("telegram-config", {
        body: {
          action: "update_default_wallet",
          defaultWalletId: selectedWalletId || null,
        },
      });
      if (error) throw error;
      await loadStatus();
      toast("Telegram wallet fallback updated.", "success");
    } catch (error) {
      toast(error.message || "Could not update default wallet.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("telegram-config", {
        body: { action: "unlink" },
      });
      if (error) throw error;
      setStatus(null);
      setLinkCode(null);
      setWeeklyAlertsEnabled(true);
      toast("Telegram account unlinked.", "success");
    } catch (error) {
      toast(error.message || "Could not unlink Telegram.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWeeklyAlerts = async (enabled) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("telegram-config", {
        body: {
          action: "update_weekly_alerts",
          weeklyAlertsEnabled: enabled,
        },
      });
      if (error) throw error;
      setWeeklyAlertsEnabled(enabled);
      await loadStatus();
      toast(
        enabled
          ? "Weekly Telegram reminders turned on."
          : "Weekly Telegram reminders turned off.",
        "success",
      );
    } catch (error) {
      toast(error.message || "Could not update weekly reminders.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendWeeklyPreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-config", {
        body: { action: "send_weekly_preview" },
      });
      if (error) throw error;
      if (data?.sent) {
        toast("Weekly reminder preview sent to Telegram.", "success");
      } else {
        toast(
          data?.message || "No reminder was sent because everything looks healthy right now.",
          "success",
        );
      }
    } catch (error) {
      toast(error.message || "Could not send weekly preview.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWeeklyAlertPreferences = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("telegram-config", {
        body: {
          action: "update_weekly_alert_preferences",
          weeklyAlertBudgetEnabled,
          weeklyAlertGoalEnabled,
          weeklyAlertInactivityEnabled,
          weeklyAlertInactivityDays: Number(weeklyAlertInactivityDays || 7),
        },
      });
      if (error) throw error;
      await loadStatus();
      toast("Weekly reminder preferences updated.", "success");
    } catch (error) {
      toast(error.message || "Could not update reminder preferences.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("telegram_transaction_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
      await loadTemplates();
      toast("Telegram template deleted.", "success");
    } catch (error) {
      toast(error.message || "Could not delete template.", "error");
    } finally {
      setLoading(false);
    }
  };

  const linkCommand = linkCode ? "/link " + linkCode.code : "";
  const templateCommand =
    "/template create Nhận lương tháng => nhận lương 20tr vào Techcombank; cho mẹ 5tr từ tài khoản";
  const templateEditCommand =
    "/template edit Nhận lương tháng => nhận lương 25tr vào Techcombank; cho mẹ 6tr từ tài khoản";
  const templateFuelPresetCommand =
    "/template create Đổ xăng => đổ xăng";

  const formatTemplateAmount = (amount) =>
    Number(amount || 0).toLocaleString("vi-VN") + "₫";

  const templateItemLabel = (item) => {
    const wallet = item.wallet?.name ? " · " + item.wallet.name : "";
    const category = item.category?.name ? " · " + item.category.name : "";
    const smart =
      item.smart_config?.kind === "monthly_sequence_description"
        ? " · auto count/month"
        : "";
    return `${item.type} ${formatTemplateAmount(item.amount)}${wallet}${category}${smart}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-neutral-200/70 dark:border-neutral-800/70 bg-neutral-100/50 dark:bg-neutral-800/50 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-neutral-900 dark:text-white">
              {status
                ? "Linked to " +
                  (status.first_name || status.username || "Telegram")
                : "Not linked yet"}
            </p>
            <p className="text-xs font-medium text-neutral-500 mt-1">
              Send Vietnamese or English transaction messages to your bot. They
              will be saved directly to this account.
            </p>
          </div>
          <Chip
            color={status ? "success" : "warning"}
            variant="flat"
            className="font-bold w-fit"
          >
            {status ? "Connected" : "Setup needed"}
          </Chip>
        </div>

        <HeroSelect
          label="Fallback wallet"
          description="Optional. If empty, Telegram messages must mention a wallet."
          selectedKeys={[walletSelectionKey(selectedWalletId)]}
          onSelectionChange={(keys) =>
            setSelectedWalletId(selectedWalletValue(keys))
          }
          variant="flat"
          isDisabled={wallets.length === 0}
        >
          <SelectItem key={NO_DEFAULT_WALLET} textValue="No fallback wallet">
            No fallback wallet
          </SelectItem>
          {wallets.map((wallet) => (
            <SelectItem key={wallet.id} textValue={wallet.name}>
              {wallet.name}
            </SelectItem>
          ))}
        </HeroSelect>

        {linkCode && (
          <div className="rounded-2xl bg-white/70 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Send this to your Telegram bot
            </p>
            <p className="mt-2 font-mono text-xl font-black text-primary">
              {linkCommand}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Expires at {new Date(linkCode.expiresAt).toLocaleString()}.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            color="primary"
            onClick={handleGenerate}
            isLoading={loading}
            startContent={<PaperAirplaneIcon className="h-4 w-4" />}
          >
            Generate Link Code
          </Button>
          {status && (
            <>
              <Button
                variant="bordered"
                onClick={handleUpdateWallet}
                isLoading={loading}
              >
                Update Fallback Wallet
              </Button>
              <Button
                color="danger"
                variant="light"
                onClick={handleUnlink}
                isLoading={loading}
              >
                Unlink
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-neutral-200/70 dark:border-neutral-800/70 bg-neutral-100/50 dark:bg-neutral-800/50 p-6 space-y-5">
        <div>
          <p className="text-sm font-black text-neutral-900 dark:text-white">
            Weekly reminders
          </p>
          <p className="text-xs font-medium text-neutral-500 mt-1">
            Every weekend, the bot can send a quick check-in when budgets are near the limit or goals are at risk of slipping.
          </p>
        </div>

        <div className="rounded-2xl bg-white/70 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-bold text-neutral-900 dark:text-white">
              {weeklyAlertsEnabled ? "Weekly reminder is on" : "Weekly reminder is off"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Reminder goes to the Telegram account linked above. You can test the current message anytime.
            </p>
            {status?.weekly_alerts_last_sent_at && (
              <p className="text-xs text-neutral-400 mt-2">
                Last sent: {new Date(status.weekly_alerts_last_sent_at).toLocaleString()}
              </p>
            )}
          </div>
          <Chip
            color={weeklyAlertsEnabled ? "success" : "default"}
            variant="flat"
            className="font-bold w-fit"
          >
            {weeklyAlertsEnabled ? "Enabled" : "Disabled"}
          </Chip>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="rounded-2xl bg-white/70 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 p-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={weeklyAlertBudgetEnabled}
              onChange={(event) => setWeeklyAlertBudgetEnabled(event.target.checked)}
              className="mt-1 rounded border-neutral-300 dark:border-neutral-700 bg-transparent text-primary focus:ring-primary"
              disabled={!status || !weeklyAlertsEnabled}
            />
            <div>
              <p className="font-bold text-neutral-900 dark:text-white">Budget risk</p>
              <p className="text-xs text-neutral-500 mt-1">
                Nhắc khi danh mục nào đó đang tiến gần hoặc vượt ngân sách tháng.
              </p>
            </div>
          </label>

          <label className="rounded-2xl bg-white/70 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 p-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={weeklyAlertGoalEnabled}
              onChange={(event) => setWeeklyAlertGoalEnabled(event.target.checked)}
              className="mt-1 rounded border-neutral-300 dark:border-neutral-700 bg-transparent text-primary focus:ring-primary"
              disabled={!status || !weeklyAlertsEnabled}
            />
            <div>
              <p className="font-bold text-neutral-900 dark:text-white">Goal risk</p>
              <p className="text-xs text-neutral-500 mt-1">
                Nhắc khi goal sắp quá hạn hoặc tiến độ đang chậm.
              </p>
            </div>
          </label>

          <label className="rounded-2xl bg-white/70 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 p-4 flex items-start gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={weeklyAlertInactivityEnabled}
              onChange={(event) => setWeeklyAlertInactivityEnabled(event.target.checked)}
              className="mt-1 rounded border-neutral-300 dark:border-neutral-700 bg-transparent text-primary focus:ring-primary"
              disabled={!status || !weeklyAlertsEnabled}
            />
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-bold text-neutral-900 dark:text-white">No activity</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Nhắc khi bạn không ghi giao dịch nào trong một số ngày liên tiếp.
                </p>
              </div>
              <HeroSelect
                label="Inactivity threshold"
                selectedKeys={[weeklyAlertInactivityDays]}
                onSelectionChange={(keys) => setWeeklyAlertInactivityDays(String(Array.from(keys)[0] || "7"))}
                variant="flat"
                isDisabled={!status || !weeklyAlertsEnabled || !weeklyAlertInactivityEnabled}
                className="max-w-xs"
              >
                <SelectItem key="3" textValue="3 days">3 days</SelectItem>
                <SelectItem key="5" textValue="5 days">5 days</SelectItem>
                <SelectItem key="7" textValue="7 days">7 days</SelectItem>
                <SelectItem key="14" textValue="14 days">14 days</SelectItem>
              </HeroSelect>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={weeklyAlertsEnabled ? "bordered" : "primary"}
            color={weeklyAlertsEnabled ? "default" : "primary"}
            onClick={() => handleUpdateWeeklyAlerts(!weeklyAlertsEnabled)}
            isLoading={loading}
            isDisabled={!status}
          >
            {weeklyAlertsEnabled ? "Turn off weekly reminder" : "Turn on weekly reminder"}
          </Button>
          <Button
            variant="bordered"
            onClick={handleUpdateWeeklyAlertPreferences}
            isLoading={loading}
            isDisabled={!status || !weeklyAlertsEnabled}
          >
            Save reminder preferences
          </Button>
          <Button
            variant="flat"
            color="primary"
            onClick={handleSendWeeklyPreview}
            isLoading={loading}
            isDisabled={!status}
          >
            Send preview to Telegram
          </Button>
        </div>
      </div>

      <div className="rounded-[2rem] border border-neutral-200/70 dark:border-neutral-800/70 bg-neutral-100/50 dark:bg-neutral-800/50 p-6 space-y-5">
        <div>
          <p className="text-sm font-black text-neutral-900 dark:text-white">
            Transaction Templates
          </p>
          <p className="text-xs font-medium text-neutral-500 mt-1">
            Create routines in Telegram, then trigger many transactions with one
            message. Example:{" "}
            <span className="font-mono">Nhận lương tháng</span>.
          </p>
        </div>

        <div className="rounded-2xl bg-white/70 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            Create from Telegram
          </p>
          <p className="mt-2 font-mono text-xs md:text-sm font-bold text-primary break-words">
            {templateCommand}
          </p>
          <p className="mt-2 font-mono text-xs md:text-sm font-bold text-neutral-500 break-words">
            {templateEditCommand}
          </p>
          <p className="mt-2 font-mono text-xs md:text-sm font-bold text-neutral-500 break-words">
            {templateFuelPresetCommand}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Then send <span className="font-mono">Nhận lương tháng</span>{" "}
            anytime to create both transactions. Use{" "}
            <span className="font-mono">/templates</span> to list,{" "}
            <span className="font-mono">/template edit ...</span> to edit, or{" "}
            <span className="font-mono">/template delete 1</span> to delete from
            Telegram. Fuel preset tip:{" "}
            <span className="font-mono">Đổ xăng</span> will auto-fill{" "}
            <span className="font-mono">60.000đ</span>, wallet{" "}
            <span className="font-mono">Tiền mặt</span>, category{" "}
            <span className="font-mono">Xăng xe</span>, and note format{" "}
            <span className="font-mono">đổ xăng lần [n]</span> with monthly reset.
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-5 text-sm text-neutral-500">
            No templates yet. Create your first one from Telegram.
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-2xl bg-white/70 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-neutral-900 dark:text-white">
                      {template.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Trigger:{" "}
                      <span className="font-mono">{template.trigger_text}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    onClick={() => handleDeleteTemplate(template.id)}
                    isLoading={loading}
                  >
                    Delete
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {(template.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-neutral-100/70 dark:bg-neutral-900/70 px-3 py-2"
                    >
                      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {templateItemLabel(item)}
                      </p>
                      {item.description && (
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Settings() {
  const t = useT();
  const {
    language,
    setLanguage,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    accentColor,
    setAccentColor,
    theme,
    setTheme,
  } = useSettingsStore();

  const [rateInput, setRateInput] = useState(String(exchangeRate));
  const [saved, setSaved] = useState(false);

  const handleRateApply = () => {
    const val = parseInt(rateInput, 10);
    if (!isNaN(val) && val > 0) {
      setExchangeRate(val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[900px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">
          {t("settings.title")}
        </h1>
        <p className="text-neutral-500">{t("settings.subtitle")}</p>
      </div>

      <GlassCard className="space-y-12">
        {/* Theme */}
        <Section
          icon={ComputerDesktopIcon}
          title={t("settings.theme")}
          description={t("settings.themeDesc")}
        >
          <Tabs
            selectedKey={theme}
            onSelectionChange={setTheme}
            variant="flat"
            color="primary"
            size="lg"
            className="w-full md:w-fit"
            classNames={{ cursor: "dark:!bg-neutral-800" }}
          >
            <Tab
              key="light"
              title={
                <div className="flex items-center gap-2">
                  <SunIcon className="w-4 h-4" />
                  <span>{t("settings.light")}</span>
                </div>
              }
            />
            <Tab
              key="dark"
              title={
                <div className="flex items-center gap-2">
                  <MoonIcon className="w-4 h-4" />
                  <span>{t("settings.dark")}</span>
                </div>
              }
            />
            <Tab
              key="system"
              title={
                <div className="flex items-center gap-2">
                  <ComputerDesktopIcon className="w-4 h-4" />
                  <span>{t("settings.system")}</span>
                </div>
              }
            />
          </Tabs>
        </Section>

        <div className="h-px bg-white/20 dark:bg-neutral-800/20 w-full" />

        {/* Accent Color */}
        <Section
          icon={SwatchIcon}
          title={t("settings.accentColor")}
          description={t("settings.accentColorDesc")}
        >
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4">
              {ACCENT_COLORS.map((c) => (
                <Tooltip key={c.value} content={c.name}>
                  <button
                    onClick={() => setAccentColor(c.value)}
                    className="relative w-12 h-12 rounded-2xl transition-all hover:scale-110 shadow-sm"
                    style={{
                      background: c.value,
                      border:
                        accentColor === c.value ? "4px solid white" : "none",
                      boxShadow:
                        accentColor === c.value
                          ? "0 0 0 2px " + c.value
                          : "none",
                    }}
                  >
                    {accentColor === c.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <CheckIcon className="h-6 w-6 text-white drop-shadow-md" />
                      </div>
                    )}
                  </button>
                </Tooltip>
              ))}
            </div>
            <div className="flex items-center gap-4 bg-neutral-100/50 dark:bg-neutral-800/50 p-4 rounded-2xl w-fit">
              <span className="text-xs font-black text-neutral-500 uppercase tracking-widest">
                Custom hex
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                />
                <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white uppercase">
                  {accentColor}
                </span>
              </div>
            </div>
          </div>
        </Section>

        <div className="h-px bg-white/20 dark:bg-neutral-800/20 w-full" />

        {/* Language */}
        <Section
          icon={GlobeAltIcon}
          title={t("settings.language")}
          description={t("settings.languageDesc")}
        >
          <Tabs
            selectedKey={language}
            onSelectionChange={setLanguage}
            variant="flat"
            size="lg"
            className="w-full md:w-fit"
          >
            <Tab
              key="en"
              title={
                <div className="flex items-center gap-2">
                  <LanguageIcon className="w-4 h-4" />
                  <span>{t("settings.english")}</span>
                </div>
              }
            />
            <Tab
              key="vi"
              title={
                <div className="flex items-center gap-2">
                  <LanguageIcon className="w-4 h-4" />
                  <span>{t("settings.vietnamese")}</span>
                </div>
              }
            />
          </Tabs>
        </Section>

        <div className="h-px bg-white/20 dark:bg-neutral-800/20 w-full" />

        {/* Currency */}
        <Section
          icon={CurrencyDollarIcon}
          title={t("settings.currency")}
          description={t("settings.currencyDesc")}
        >
          <div className="space-y-8">
            <Tabs
              selectedKey={currency}
              onSelectionChange={setCurrency}
              variant="flat"
              size="lg"
              className="w-full md:w-fit"
            >
              <Tab key="USD" title="$ USD – US Dollar" />
              <Tab key="VND" title="₫ VND – Việt Nam Đồng" />
            </Tabs>

            <div className="bg-neutral-100/50 dark:bg-neutral-800/50 p-6 rounded-[2rem] space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 px-1">
                    {t("settings.exchangeRateHint")}
                  </p>
                  <div className="flex items-center gap-3">
                    <HeroInput
                      type="number"
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      variant="flat"
                      className="w-48"
                      endContent={
                        <span className="text-xs font-black text-neutral-400">
                          VND
                        </span>
                      }
                    />
                    <Button
                      color="primary"
                      onClick={handleRateApply}
                      className="font-black px-8"
                    >
                      {saved ? "Saved!" : t("common.save")}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col items-end px-2">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                    Preview
                  </p>
                  <p className="text-xl font-black text-neutral-900 dark:text-white tabular-nums">
                    100 USD ={" "}
                    <span className="text-primary">
                      {(100 * parseInt(rateInput || "0", 10)).toLocaleString(
                        "vi-VN",
                      )}{" "}
                      ₫
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <div className="h-px bg-white/20 dark:bg-neutral-800/20 w-full" />

        <Section
          icon={PaperAirplaneIcon}
          title="Telegram Bot"
          description="Link Telegram to quick-add transactions without opening the web app."
        >
          <TelegramBotSettings />
        </Section>
      </GlassCard>
    </div>
  );
}
