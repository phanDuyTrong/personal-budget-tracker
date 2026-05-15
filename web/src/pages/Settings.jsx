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
import {
  Button,
  Input as HeroInput,
  Select as HeroSelect,
  Tabs,
  Tab,
  Chip,
  Card,
  Tooltip,
  SelectItem,
} from "@heroui/react";
import { useSettingsStore, ACCENT_COLORS } from "@/stores/settingsStore";
import { useT } from "@/hooks/useTranslation";
import { useWallets } from "@/features/wallets/hooks";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui";

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

function TelegramBotSettings() {
  const toast = useToast();
  const { data: wallets = [] } = useWallets();
  const [status, setStatus] = useState(null);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [linkCode, setLinkCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    const { data, error } = await supabase.functions.invoke("telegram-config", {
      body: { action: "status" },
    });
    if (error) throw error;
    setStatus(data?.link || null);
    if (data?.link?.default_wallet_id)
      setSelectedWalletId(data.link.default_wallet_id);
  };

  useEffect(() => {
    loadStatus().catch(() => {
      setStatus(null);
    });
  }, []);

  useEffect(() => {
    if (!selectedWalletId && wallets.length > 0)
      setSelectedWalletId(wallets[0].id);
  }, [selectedWalletId, wallets]);

  const handleGenerate = async () => {
    if (!selectedWalletId) {
      toast("Choose a default wallet first.", "error");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "telegram-config",
        {
          body: {
            action: "create_link_code",
            defaultWalletId: selectedWalletId,
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
          defaultWalletId: selectedWalletId,
        },
      });
      if (error) throw error;
      await loadStatus();
      toast("Default Telegram wallet updated.", "success");
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
      toast("Telegram account unlinked.", "success");
    } catch (error) {
      toast(error.message || "Could not unlink Telegram.", "error");
    } finally {
      setLoading(false);
    }
  };

  const linkCommand = linkCode ? "/link " + linkCode.code : "";

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
          label="Default wallet"
          description="Used when your Telegram message does not mention a wallet."
          selectedKeys={selectedWalletId ? [selectedWalletId] : []}
          onSelectionChange={(keys) =>
            setSelectedWalletId(Array.from(keys)[0] || "")
          }
          variant="flat"
          isDisabled={wallets.length === 0}
        >
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
                Update Default Wallet
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
