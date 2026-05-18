import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  Autocomplete,
  AutocompleteItem,
  Button,
  Pagination,
  Chip,
  Tooltip,
  SelectItem,
  Checkbox,
} from "@heroui/react";

import {
  useTransactions,
  useTransactionMutations,
} from "@/features/transactions/hooks";
import { useWallets } from "@/features/wallets/hooks";
import { useCategories } from "@/features/categories/hooks";
import { useContacts } from "@/features/contacts/hooks";
import { useTrips } from "@/features/trips/hooks";
import { aiService, buildTransactionDraft } from "@/lib/aiParser";
import { useSettingsStore } from "@/stores/settingsStore";
import { viFilter } from "@/lib/filters";
import {
  Modal,
  AmountInput,
  Field,
  TableSkeleton,
  EmptyState,
  AmountDisplay,
  ConfirmModal,
  useToast,
  Textarea,
  DatePicker as CustomDatePicker,
} from "@/components/ui";

const getEmptyForm = () => ({
  amount: "",
  type: "expense",
  walletId: "",
  categoryId: "",
  contactId: "",
  tripId: "",
  description: "",
  date: format(new Date(), "yyyy-MM-dd"),
  isRecurring: false,
  isDebt: false,
  toWalletId: "",
});

function QuickAddModal({
  open,
  onClose,
  wallets,
  categories,
  contacts,
  onDraft,
}) {
  const [input, setInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const toast = useToast();

  const examples = [
    "ăn trưa 85k bằng tiền mặt",
    "nhận lương 20tr vào Techcombank",
    "chuyển 2tr từ Cash sang Savings",
  ];

  const handleParse = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsParsing(true);
    try {
      const parsed = await aiService.parseTransaction(input.trim(), {
        wallets,
        categories,
        contacts,
      });
      const draft = buildTransactionDraft(parsed, {
        wallets,
        categories,
        contacts,
      });
      if (!draft.amount)
        throw new Error(
          "AI could not detect an amount. Try adding a clearer number.",
        );
      onDraft(draft);
      setInput("");
      toast(
        "AI filled a transaction draft. Review it before saving.",
        "success",
      );
    } catch (err) {
      toast(err.message || "AI could not parse this transaction.", "error");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="AI Quick Add" size="md">
      <form onSubmit={handleParse} className="p-6 space-y-5">
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            Viết như bạn nhắn tin cho chính mình.
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            AI sẽ đọc số tiền, ví, danh mục, ngày và người liên quan, rồi mở
            form để bạn kiểm tra trước khi lưu.
          </p>
        </div>

        <Field label="Transaction sentence">
          <Textarea
            autoFocus
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ví dụ: ăn phở 55k bằng tiền mặt hôm nay"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              className="rounded-full border border-neutral-200 bg-white/60 px-3 py-1.5 text-xs text-neutral-600 transition hover:border-primary/40 hover:text-primary dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            type="submit"
            isLoading={isParsing}
            startContent={!isParsing && <SparklesIcon className="h-4 w-4" />}
          >
            Fill Transaction
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TransactionModal({ open, onClose, transaction }) {
  const { currency } = useSettingsStore();
  const sym = currency === "VND" ? "₫" : "$";

  const isDuplicate = transaction?.intent === "duplicate";
  const isQuickAdd = transaction?.intent === "quick-add";
  const txData = transaction?.data || transaction || null;

  const [form, setForm] = useState(
    txData
      ? {
          ...txData,
          amount: txData.amount,
          walletId: txData.wallet_id || txData.walletId || "",
          toWalletId: txData.to_wallet_id || txData.toWalletId || "",
          categoryId: txData.category_id || txData.categoryId || "",
          contactId: txData.contact_id || txData.contactId || "",
          tripId: txData.trip_id || txData.tripId || "",
          isDebt:
            txData.is_debt !== undefined ? !!txData.is_debt : !!txData.isDebt,
          date: isDuplicate
            ? format(new Date(), "yyyy-MM-dd")
            : format(new Date(txData.date || new Date()), "yyyy-MM-dd"),
        }
      : getEmptyForm(),
  );
  const [splits, setSplits] = useState([]);
  const [isSplit, setIsSplit] = useState(false);
  const { create, update, setSplits: saveSplits } = useTransactionMutations();
  const { data: wallets = [] } = useWallets();
  const { data: categoryTree = [] } = useCategories();
  const { data: contacts = [] } = useContacts();
  const { data: trips = [] } = useTrips();
  const toast = useToast();

  // Detect if selected category belongs to "Du lịch" tree
  const isTravelCategory = useMemo(() => {
    if (!form.categoryId) return false;
    const findTravelRoot = (nodes) => {
      for (const node of nodes) {
        if (
          node.name.toLowerCase().includes("du lịch") ||
          node.name.toLowerCase().includes("travel")
        ) {
          const ids = new Set();
          const collect = (n) => {
            ids.add(n.id);
            if (n.children) n.children.forEach(collect);
          };
          collect(node);
          return ids;
        }
        if (node.children) {
          const r = findTravelRoot(node.children);
          if (r) return r;
        }
      }
      return null;
    };
    const travelIds = findTravelRoot(categoryTree);
    return travelIds ? travelIds.has(form.categoryId) : false;
  }, [form.categoryId, categoryTree]);

  const flatCats = useMemo(() => {
    const flat = [];
    const traverse = (cats, level = 0) => {
      cats.forEach((c) => {
        flat.push({ ...c, label: (level > 0 ? "　" : "") + c.name });
        if (c.children) traverse(c.children, level + 1);
      });
    };
    traverse(categoryTree);
    return flat;
  }, [categoryTree]);

  const isEdit = !!txData?.id && !isDuplicate && !isQuickAdd;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let saved;
      if (isEdit) {
        saved = await update.mutateAsync({ id: txData.id, ...form });
      } else {
        saved = await create.mutateAsync(form);
      }
      if (isSplit && splits.length > 0)
        await saveSplits.mutateAsync({ id: saved.id, splits });
      toast(`Transaction ${isEdit ? "updated" : "created"}!`, "success");
      onClose();
    } catch (err) {
      toast(
        err.response?.data?.error?.message || "Error saving transaction",
        "error",
      );
    }
  };

  const handleFormChange = (field, value) =>
    setForm((p) => ({ ...p, [field]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit
          ? "Edit Transaction"
          : isQuickAdd
            ? "Review AI Transaction"
            : "New Transaction"
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Amount (${sym})`}>
            <AmountInput
              placeholder={currency === "VND" ? "0 ₫" : "0.00"}
              value={form.amount}
              onChange={(e) => handleFormChange("amount", e.target.value)}
              required
            />
          </Field>
          <Field label="Type">
            <Select
              selectedKeys={[form.type]}
              onSelectionChange={(keys) =>
                handleFormChange("type", Array.from(keys)[0])
              }
              variant="flat"
            >
              <SelectItem key="expense" textValue="Expense">
                Expense
              </SelectItem>
              <SelectItem key="income" textValue="Income">
                Income
              </SelectItem>
              <SelectItem key="transfer" textValue="Transfer">
                Transfer
              </SelectItem>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date">
            <CustomDatePicker
              value={form.date}
              onChange={(val) => handleFormChange("date", val)}
            />
          </Field>
          <Field label="Wallet">
            <Autocomplete
              placeholder="Search wallet..."
              defaultFilter={viFilter}
              selectedKey={form.walletId || null}
              onSelectionChange={(key) =>
                handleFormChange("walletId", key || "")
              }
              variant="flat"
              isRequired
            >
              {wallets.map((a) => (
                <AutocompleteItem key={a.id} textValue={a.name}>
                  {a.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          </Field>
        </div>
        {form.type === "transfer" && (
          <Field label="To Wallet">
            <Autocomplete
              placeholder="Search destination..."
              defaultFilter={viFilter}
              selectedKey={form.toWalletId || null}
              onSelectionChange={(key) =>
                handleFormChange("toWalletId", key || "")
              }
              variant="flat"
              isRequired
            >
              {wallets
                .filter((a) => a.id !== form.walletId)
                .map((a) => (
                  <AutocompleteItem key={a.id} textValue={a.name}>
                    {a.name}
                  </AutocompleteItem>
                ))}
            </Autocomplete>
          </Field>
        )}
        <Field label="Category">
          <Autocomplete
            placeholder="Search category..."
            defaultFilter={viFilter}
            selectedKey={form.categoryId || null}
            onSelectionChange={(key) =>
              handleFormChange("categoryId", key || "")
            }
            variant="flat"
          >
            {flatCats.map((cat) => (
              <AutocompleteItem key={cat.id} textValue={cat.name}>
                {cat.label}
              </AutocompleteItem>
            ))}
          </Autocomplete>
        </Field>
        {isTravelCategory && (
          <Field label="Chuyến đi 🗺">
            <Autocomplete
              placeholder="Chọn chuyến đi..."
              defaultFilter={viFilter}
              selectedKey={form.tripId || null}
              onSelectionChange={(key) => handleFormChange("tripId", key || "")}
              variant="flat"
            >
              {trips.map((trip) => (
                <AutocompleteItem key={trip.id} textValue={trip.name}>
                  {trip.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          </Field>
        )}
        <Field label="For Who (Contact)">
          <Autocomplete
            placeholder="Search contact..."
            defaultFilter={viFilter}
            selectedKey={form.contactId || null}
            onSelectionChange={(key) =>
              handleFormChange("contactId", key || "")
            }
            variant="flat"
          >
            {contacts.map((c) => (
              <AutocompleteItem key={c.id} textValue={c.name}>
                {c.name}
              </AutocompleteItem>
            ))}
          </Autocomplete>
          {form.contactId && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="isDebt"
                checked={form.isDebt}
                onChange={(e) => handleFormChange("isDebt", e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-700 bg-transparent text-primary focus:ring-primary"
              />
              <label htmlFor="isDebt" className="text-sm text-neutral-500">
                Record as Debt
              </label>
            </div>
          )}
        </Field>
        <Field label="Description">
          <Textarea
            placeholder="Optional note..."
            value={form.description || ""}
            onChange={(e) => handleFormChange("description", e.target.value)}
            rows={2}
          />
        </Field>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="split"
            checked={isSplit}
            onChange={(e) => setIsSplit(e.target.checked)}
            className="rounded border-neutral-300 dark:border-neutral-700 bg-transparent text-primary focus:ring-primary"
          />
          <label htmlFor="split" className="text-sm text-neutral-500">
            Split transaction
          </label>
        </div>

        {isSplit && (
          <div className="space-y-2 p-3 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
            <p className="text-xs font-medium text-neutral-500 mb-2">
              Splits (must sum to total)
            </p>
            {splits.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Autocomplete
                  className="flex-1"
                  placeholder="Search category..."
                  defaultFilter={viFilter}
                  selectedKey={s.categoryId || null}
                  onSelectionChange={(key) => {
                    const n = [...splits];
                    n[i].categoryId = key || "";
                    setSplits(n);
                  }}
                  variant="flat"
                  size="sm"
                >
                  {flatCats.map((c) => (
                    <AutocompleteItem key={c.id} textValue={c.name}>
                      {c.label}
                    </AutocompleteItem>
                  ))}
                </Autocomplete>
                <AmountInput
                  className="w-32"
                  placeholder="0.00"
                  value={s.amount}
                  onChange={(e) => {
                    const n = [...splits];
                    n[i].amount = e.target.value;
                    setSplits(n);
                  }}
                />
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onClick={() => setSplits(splits.filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="light"
              size="sm"
              color="primary"
              onClick={() =>
                setSplits([...splits, { categoryId: "", amount: "" }])
              }
            >
              + Add split
            </Button>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            type="submit"
            isLoading={create.isPending || update.isPending}
          >
            {isEdit
              ? "Save Changes"
              : isDuplicate
                ? "Duplicate Transaction"
                : "Add Transaction"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function collectCategoryAndDescendantIds(categories, selectedId) {
  if (!selectedId || selectedId === "all") return [];

  const findNode = (nodes) => {
    for (const node of nodes || []) {
      if (node.id === selectedId) return node;
      const childMatch = findNode(node.children);
      if (childMatch) return childMatch;
    }
    return null;
  };

  const collectIds = (node) => [
    node.id,
    ...((node.children || []).flatMap((child) => collectIds(child))),
  ];

  const selectedNode = findNode(categories);
  return selectedNode ? collectIds(selectedNode) : [selectedId];
}

export function Transactions() {
  const [page, setPage] = useState(1);
  const [selectedRowKeys, setSelectedRowKeys] = useState(new Set([]));
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [filters, setFilters] = useState({
    type: "all",
    search: "",
    walletId: "all",
    categoryId: "all",
    contactId: "all",
    sortDate: "newest",
  });
  const [modal, setModal] = useState(null); // null | 'new' | transaction
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);
  const toast = useToast();

  const updateFilter = (k, v) => {
    setFilters((prev) => ({ ...prev, [k]: v }));
    setPage(1);
  };

  const {
    remove,
    bulkUpdateCategory,
    restoreCategories,
    bulkDelete,
    restoreDeleted,
  } = useTransactionMutations();
  const { data: wallets = [] } = useWallets();
  const { data: categoryTree = [] } = useCategories();
  const { data: contacts = [] } = useContacts();

  const selectedCategoryIds = useMemo(
    () => collectCategoryAndDescendantIds(categoryTree, filters.categoryId),
    [categoryTree, filters.categoryId],
  );

  const params = {
    page,
    limit: 50,
    ...(filters.type !== "all" && { type: filters.type }),
    ...(filters.search && { search: filters.search }),
    ...(filters.walletId !== "all" && { wallet_id: filters.walletId }),
    ...(selectedCategoryIds.length > 0 && { category_ids: selectedCategoryIds }),
    ...(filters.contactId !== "all" && { contact_id: filters.contactId }),
    sortDate: filters.sortDate,
  };

  const { data, isLoading } = useTransactions(params);

  const txs = useMemo(() => data?.data || [], [data?.data]);
  const totalPages = data?.totalPages || 1;

  const selectedRows = useMemo(
    () => txs.filter((tx) => selectedRowKeys.has(tx.id)),
    [selectedRowKeys, txs],
  );
  const selectedCount = selectedRows.length;
  const visibleIds = useMemo(() => txs.map((tx) => tx.id), [txs]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedRowKeys.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedRowKeys.has(id)) && !allVisibleSelected;

  const flatCats = useMemo(() => {
    const flat = [];
    const traverse = (cats, level = 0) => {
      cats.forEach((c) => {
        flat.push({ ...c, label: (level > 0 ? "　" : "") + c.name });
        if (c.children) traverse(c.children, level + 1);
      });
    };
    traverse(categoryTree);
    return flat;
  }, [categoryTree]);

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(confirmDel);
      toast("Deleted", "success");
    } catch {
      toast("Error deleting", "error");
    }
    setConfirmDel(null);
  };

  const clearBulkSelection = () => {
    setSelectedRowKeys(new Set([]));
    setBulkCategoryId("");
  };

  const toggleRowSelection = React.useCallback((id, selected) => {
    setSelectedRowKeys((previous) => {
      const next = new Set(previous);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleVisibleSelection = React.useCallback((selected) => {
    setSelectedRowKeys((previous) => {
      const next = new Set(previous);
      visibleIds.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, [visibleIds]);

  const handleBulkCategoryUpdate = async () => {
    if (!bulkCategoryId || selectedRows.length === 0) return;
    const previousRows = selectedRows.map((tx) => ({
      id: tx.id,
      category_id: tx.category_id || null,
      updated_at: tx.updated_at || null,
    }));
    const ids = selectedRows.map((tx) => tx.id);

    try {
      await bulkUpdateCategory.mutateAsync({
        ids,
        categoryId: bulkCategoryId === "__none__" ? null : bulkCategoryId,
      });
      const count = selectedRows.length;
      clearBulkSelection();
      toast(`${count} transaction${count > 1 ? "s" : ""} updated`, "success", {
        duration: 9000,
        actionLabel: "Undo",
        onAction: async () => {
          try {
            await restoreCategories.mutateAsync(previousRows);
            toast("Bulk category update undone", "success");
          } catch {
            toast("Could not undo bulk update", "error");
          }
        },
      });
    } catch {
      toast("Error updating selected transactions", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    const deletedRows = JSON.parse(JSON.stringify(selectedRows));
    const ids = selectedRows.map((tx) => tx.id);

    try {
      await bulkDelete.mutateAsync(ids);
      const count = selectedRows.length;
      setConfirmBulkDel(false);
      clearBulkSelection();
      toast(`${count} transaction${count > 1 ? "s" : ""} deleted`, "success", {
        duration: 9000,
        actionLabel: "Undo",
        onAction: async () => {
          try {
            await restoreDeleted.mutateAsync(deletedRows);
            toast("Bulk delete undone", "success");
          } catch {
            toast("Could not undo bulk delete", "error");
          }
        },
      });
    } catch {
      toast("Error deleting selected transactions", "error");
      setConfirmBulkDel(false);
    }
  };

  const handleExport = () => {
    window.open("/api/export/transactions/csv", "_blank");
  };

  const columns = [
    { name: "SELECT", uid: "select" },
    { name: "DATE", uid: "date" },
    { name: "WALLET", uid: "wallet" },
    { name: "TYPE/AMOUNT", uid: "amount" },
    { name: "CATEGORY", uid: "category" },
    { name: "CONTACT", uid: "contact" },
    { name: "DESCRIPTION", uid: "description" },
    { name: "ACTIONS", uid: "actions" },
  ];

  const renderCell = React.useCallback((tx, columnKey) => {
    const cellValue = tx[columnKey];

    switch (columnKey) {
      case "select":
        return (
          <Checkbox
            aria-label={`Select transaction ${tx.description || tx.id}`}
            isSelected={selectedRowKeys.has(tx.id)}
            onValueChange={(selected) => toggleRowSelection(tx.id, selected)}
          />
        );
      case "date":
        return (
          <div className="flex flex-col">
            <p className="text-bold text-sm text-neutral-900 dark:text-white">
              {format(parseISO(tx.date), "MMM d, yyyy")}
            </p>
            <p className="text-bold text-xs text-neutral-500 capitalize">
              {format(parseISO(tx.date), "EEEE")}
            </p>
          </div>
        );
      case "wallet":
        return (
          <div className="flex flex-col">
            <p className="text-bold text-sm text-neutral-900 dark:text-white">
              {tx.wallet?.name || "—"}
            </p>
            {tx.type === "transfer" && tx.to_wallet && (
              <p className="text-bold text-xs text-neutral-500">
                → {tx.to_wallet.name}
              </p>
            )}
          </div>
        );
      case "amount":
        return <AmountDisplay amount={Number(tx.amount)} type={tx.type} />;
      case "category":
        return (
          <Chip
            variant="flat"
            size="sm"
            style={{
              backgroundColor: tx.category?.color + "20",
              color: tx.category?.color,
            }}
          >
            {tx.category?.name || "Uncategorized"}
          </Chip>
        );
      case "contact":
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm">{tx.contact?.name || "—"}</span>
            {tx.is_debt && (
              <Chip
                size="xs"
                color="primary"
                variant="solid"
                className="h-4 text-[9px]"
              >
                DEBT
              </Chip>
            )}
          </div>
        );
      case "description":
        return (
          <p
            className="text-sm text-neutral-500 max-w-[200px] truncate"
            title={tx.description}
          >
            {tx.description || "—"}
          </p>
        );
      case "actions":
        return (
          <div className="relative flex items-center gap-1">
            <Tooltip content="Edit">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onClick={() => setModal({ intent: "edit", data: tx })}
              >
                <PencilIcon className="h-4 w-4 text-neutral-400" />
              </Button>
            </Tooltip>
            <Tooltip content="Duplicate">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onClick={() => setModal({ intent: "duplicate", data: tx })}
              >
                <DocumentDuplicateIcon className="h-4 w-4 text-neutral-400" />
              </Button>
            </Tooltip>
            <Tooltip color="danger" content="Delete">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                onClick={() => setConfirmDel(tx.id)}
              >
                <TrashIcon className="h-4 w-4 text-neutral-400 hover:text-danger" />
              </Button>
            </Tooltip>
          </div>
        );
      default:
        return cellValue;
    }
  }, [selectedRowKeys, toggleRowSelection]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
            Transactions
          </h1>
          <p className="text-neutral-500">Manage and track your cash flow</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<ArrowDownTrayIcon className="h-4 w-4" />}
            onClick={handleExport}
          >
            Export CSV
          </Button>
          <Button
            variant="bordered"
            startContent={<SparklesIcon className="h-4 w-4" />}
            onClick={() => setQuickAddOpen(true)}
          >
            AI Quick Add
          </Button>
          <Button
            color="primary"
            startContent={<PlusIcon className="h-4 w-4" />}
            onClick={() => setModal("new")}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Glassmorphic Filters Card */}
      <div className="glass-card backdrop-blur-xl rounded-3xl p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            isClearable
            placeholder="Search description..."
            startContent={
              <MagnifyingGlassIcon className="h-4 w-4 text-neutral-400" />
            }
            value={filters.search}
            onValueChange={(v) => updateFilter("search", v)}
            variant="flat"
          />
          <Select
            placeholder="Transaction Type"
            selectedKeys={[filters.type]}
            onSelectionChange={(keys) =>
              updateFilter("type", Array.from(keys)[0])
            }
            variant="flat"
          >
            <SelectItem key="all">All Types</SelectItem>
            <SelectItem key="income">Income</SelectItem>
            <SelectItem key="expense">Expense</SelectItem>
            <SelectItem key="transfer">Transfer</SelectItem>
          </Select>
          <Select
            placeholder="Sort By"
            selectedKeys={[filters.sortDate]}
            onSelectionChange={(keys) =>
              updateFilter("sortDate", Array.from(keys)[0])
            }
            variant="flat"
          >
            <SelectItem key="newest">Newest First</SelectItem>
            <SelectItem key="oldest">Oldest First</SelectItem>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Autocomplete
            placeholder="Search Wallets..."
            defaultFilter={viFilter}
            selectedKey={filters.walletId === "all" ? null : filters.walletId}
            onSelectionChange={(key) => updateFilter("walletId", key || "all")}
            variant="flat"
          >
            <AutocompleteItem key="all" textValue="All Wallets">
              All Wallets
            </AutocompleteItem>
            {wallets.map((w) => (
              <AutocompleteItem key={w.id} textValue={w.name}>
                {w.name}
              </AutocompleteItem>
            ))}
          </Autocomplete>
          <Autocomplete
            placeholder="Search Categories..."
            defaultFilter={viFilter}
            selectedKey={
              filters.categoryId === "all" ? null : filters.categoryId
            }
            onSelectionChange={(key) =>
              updateFilter("categoryId", key || "all")
            }
            variant="flat"
          >
            <AutocompleteItem key="all" textValue="All Categories">
              All Categories
            </AutocompleteItem>
            {flatCats.map((cat) => (
              <AutocompleteItem key={cat.id} textValue={cat.name}>
                {cat.label}
              </AutocompleteItem>
            ))}
          </Autocomplete>
          <Autocomplete
            placeholder="Search Contacts..."
            defaultFilter={viFilter}
            selectedKey={filters.contactId === "all" ? null : filters.contactId}
            onSelectionChange={(key) => updateFilter("contactId", key || "all")}
            variant="flat"
          >
            <AutocompleteItem key="all" textValue="All Contacts">
              All Contacts
            </AutocompleteItem>
            {contacts.map((c) => (
              <AutocompleteItem key={c.id} textValue={c.name}>
                {c.name}
              </AutocompleteItem>
            ))}
          </Autocomplete>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="glass-card flex flex-col gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black text-neutral-900 dark:text-white">
              {selectedCount} transaction{selectedCount > 1 ? "s" : ""} selected
            </p>
            <p className="text-xs font-medium text-neutral-500">
              Bulk edit category or delete these selected rows.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Autocomplete
              className="min-w-[240px]"
              placeholder="Set category..."
              defaultFilter={viFilter}
              selectedKey={bulkCategoryId || null}
              onSelectionChange={(key) => setBulkCategoryId(key || "")}
              variant="flat"
            >
              <AutocompleteItem key="__none__" textValue="No Category">
                No Category
              </AutocompleteItem>
              {flatCats.map((cat) => (
                <AutocompleteItem key={cat.id} textValue={cat.name}>
                  {cat.label}
                </AutocompleteItem>
              ))}
            </Autocomplete>
            <Button
              color="primary"
              isDisabled={!bulkCategoryId}
              isLoading={bulkUpdateCategory.isPending}
              onClick={handleBulkCategoryUpdate}
            >
              Apply Category
            </Button>
            <Button
              color="danger"
              variant="flat"
              isLoading={bulkDelete.isPending}
              startContent={<TrashIcon className="h-4 w-4" />}
              onClick={() => setConfirmBulkDel(true)}
            >
              Delete Selected
            </Button>
            <Button variant="light" onClick={clearBulkSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="glass-card backdrop-blur-md rounded-3xl overflow-hidden shadow-xl overflow-x-auto">
        <Table
          aria-label="Transactions table"
          removeWrapper
          className="bg-transparent min-w-[760px]"
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn
                key={column.uid}
                className={`bg-neutral-100/50 dark:bg-neutral-800/50 text-muted-foreground font-bold uppercase py-4 ${
                  column.uid === "select" ? "w-12 px-4" : ""
                }`}
              >
                {column.uid === "select" ? (
                  <Checkbox
                    aria-label="Select all visible transactions"
                    isSelected={allVisibleSelected}
                    isIndeterminate={someVisibleSelected}
                    onValueChange={toggleVisibleSelection}
                  />
                ) : (
                  column.name
                )}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={txs}
            isLoading={isLoading}
            loadingContent={<TableSkeleton rows={10} cols={8} />}
            emptyContent={
              <EmptyState
                icon={ArrowsRightLeftIcon}
                title="No transactions found"
                description="Adjust your filters or add a new transaction."
              />
            }
          >
            {(item) => (
              <TableRow
                key={item.id}
                className="border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
              >
                {(columnKey) => (
                  <TableCell className="py-4">
                    {renderCell(item, columnKey)}
                  </TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Section */}
      {totalPages > 1 && (
        <div className="flex justify-center md:justify-end pb-8">
          <Pagination
            showControls
            total={totalPages}
            initialPage={1}
            page={page}
            onChange={setPage}
            color="primary"
            variant="flat"
          />
        </div>
      )}

      {/* Modals */}
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        wallets={wallets}
        categories={categoryTree}
        contacts={contacts}
        onDraft={(draft) => {
          setQuickAddOpen(false);
          setModal({ intent: "quick-add", data: draft });
        }}
      />
      {modal === "new" && (
        <TransactionModal open onClose={() => setModal(null)} />
      )}
      {modal && modal !== "new" && (
        <TransactionModal
          open
          onClose={() => setModal(null)}
          transaction={modal}
        />
      )}
      <ConfirmModal
        open={!!confirmDel}
        title="Delete Transaction"
        description="This will permanently delete the transaction and reverse the wallet balance."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
      />
      <ConfirmModal
        open={confirmBulkDel}
        title="Delete Selected Transactions"
        description={`This will delete ${selectedCount} selected transaction${selectedCount > 1 ? "s" : ""}. You can undo from the success toast right after it completes.`}
        confirmLabel="Delete Selected"
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDel(false)}
      />
    </div>
  );
}
