import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Coffee,
  Plus,
  Minus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Receipt,
  ChevronRight,
  X,
  Check,
  Calendar,
  ListOrdered,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "./supabaseClient";

// ---------- helpers ----------

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthStr = (dateStr) => dateStr.slice(0, 7);

const fmtBaht = (n) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);

const dayLabel = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

const EXPENSE_TYPES = ["ค่าเช่า", "ค่าแรง", "ค่าไฟ", "ค่าน้ำ", "อื่นๆ"];

const STARTER_MENUS = [
  {
    name: "ลาเต้",
    variants: [
      { label: "ร้อน", price: 45, cost: 18 },
      { label: "เย็น", price: 50, cost: 20 },
    ],
  },
  {
    name: "ชาไทย",
    variants: [
      { label: "เล็ก", price: 35, cost: 14 },
      { label: "ใหญ่", price: 45, cost: 18 },
    ],
  },
  {
    name: "อเมริกาโน่",
    variants: [{ label: "เย็น", price: 40, cost: 12 }],
  },
];

// ---------- Supabase data layer ----------

async function fetchMenusWithVariants() {
  const { data: menus, error: menuErr } = await supabase
    .from("menus")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  if (menuErr) throw menuErr;

  const { data: variants, error: varErr } = await supabase
    .from("menu_variants")
    .select("id, menu_id, label, price, cost")
    .order("created_at", { ascending: true });
  if (varErr) throw varErr;

  return (menus || []).map((m) => ({
    id: m.id,
    name: m.name,
    variants: (variants || [])
      .filter((v) => v.menu_id === m.id)
      .map((v) => ({
        id: v.id,
        label: v.label,
        price: Number(v.price),
        cost: Number(v.cost),
      })),
  }));
}

async function seedStarterMenus() {
  for (const menu of STARTER_MENUS) {
    const { data: menuRow, error: menuErr } = await supabase
      .from("menus")
      .insert({ name: menu.name })
      .select()
      .single();
    if (menuErr) {
      console.error("seed menu failed", menuErr);
      continue;
    }
    const variantRows = menu.variants.map((v) => ({
      menu_id: menuRow.id,
      label: v.label,
      price: v.price,
      cost: v.cost,
    }));
    const { error: varErr } = await supabase
      .from("menu_variants")
      .insert(variantRows);
    if (varErr) console.error("seed variants failed", varErr);
  }
}

async function fetchSalesForDate(date) {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("sale_date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    menuId: row.menu_id,
    variantId: row.variant_id,
    menuName: row.menu_name,
    variantLabel: row.variant_label,
    price: Number(row.price),
    cost: Number(row.cost),
    qty: row.qty,
  }));
}

async function fetchExpensesForDate(date) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("expense_date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    note: row.note || "",
  }));
}

async function fetchAllSalesAndExpenses() {
  const { data: salesData, error: salesErr } = await supabase
    .from("sales")
    .select("*");
  if (salesErr) throw salesErr;
  const { data: expensesData, error: expErr } = await supabase
    .from("expenses")
    .select("*");
  if (expErr) throw expErr;
  const { data: samplesData, error: samplesErr } = await supabase
    .from("samples")
    .select("*");
  if (samplesErr) throw samplesErr;

  const sales = {};
  (salesData || []).forEach((row) => {
    const d = row.sale_date;
    if (!sales[d]) sales[d] = [];
    sales[d].push({
      id: row.id,
      menuId: row.menu_id,
      variantId: row.variant_id,
      menuName: row.menu_name,
      variantLabel: row.variant_label,
      price: Number(row.price),
      cost: Number(row.cost),
      qty: row.qty,
    });
  });

  const expenses = {};
  (expensesData || []).forEach((row) => {
    const d = row.expense_date;
    if (!expenses[d]) expenses[d] = [];
    expenses[d].push({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      note: row.note || "",
    });
  });

  const samples = {};
  (samplesData || []).forEach((row) => {
    const d = row.sample_date;
    if (!samples[d]) samples[d] = [];
    samples[d].push({
      id: row.id,
      menuId: row.menu_id,
      variantId: row.variant_id,
      menuName: row.menu_name,
      variantLabel: row.variant_label,
      cost: Number(row.cost),
      qty: row.qty,
    });
  });

  return { sales, expenses, samples };
}

// ---------- main component ----------

export default function App() {
  const [tab, setTab] = useState("record");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [configError, setConfigError] = useState(false);

  const [menus, setMenus] = useState([]);
  const [sales, setSales] = useState({});
  const [expenses, setExpenses] = useState({});
  const [samples, setSamples] = useState({});

  const [selectedDate, setSelectedDate] = useState(todayStr());

  const reloadAll = useCallback(async () => {
    try {
      const [menuData, { sales: s, expenses: e, samples: sm }] = await Promise.all([
        fetchMenusWithVariants(),
        fetchAllSalesAndExpenses(),
      ]);
      if (menuData.length === 0) {
        await seedStarterMenus();
        const seeded = await fetchMenusWithVariants();
        setMenus(seeded);
      } else {
        setMenus(menuData);
      }
      setSales(s);
      setExpenses(e);
      setSamples(sm);
    } catch (err) {
      console.error("load failed", err);
      setConfigError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const flashSaved = useCallback(() => {
    setSaveState("saving");
    setTimeout(() => setSaveState("saved"), 250);
    setTimeout(() => setSaveState("idle"), 1400);
  }, []);

  // ---- mutations ----

  const addSale = async (variantRef, qtyDelta) => {
    const list = sales[selectedDate] ? [...sales[selectedDate]] : [];
    const idx = list.findIndex(
      (s) => s.menuId === variantRef.menuId && s.variantId === variantRef.variantId
    );

    flashSaved();

    if (idx >= 0) {
      const newQty = list[idx].qty + qtyDelta;
      if (newQty <= 0) {
        const lineId = list[idx].id;
        list.splice(idx, 1);
        setSales({ ...sales, [selectedDate]: list });
        await supabase.from("sales").delete().eq("id", lineId);
      } else {
        list[idx] = { ...list[idx], qty: newQty };
        setSales({ ...sales, [selectedDate]: list });
        await supabase
          .from("sales")
          .update({ qty: newQty })
          .eq("id", list[idx].id);
      }
    } else if (qtyDelta > 0) {
      const tempId = uid();
      const newLine = {
        id: tempId,
        menuId: variantRef.menuId,
        variantId: variantRef.variantId,
        menuName: variantRef.menuName,
        variantLabel: variantRef.variantLabel,
        price: variantRef.price,
        cost: variantRef.cost,
        qty: qtyDelta,
      };
      list.push(newLine);
      setSales({ ...sales, [selectedDate]: list });

      const { data, error } = await supabase
        .from("sales")
        .insert({
          sale_date: selectedDate,
          menu_id: variantRef.menuId,
          variant_id: variantRef.variantId,
          menu_name: variantRef.menuName,
          variant_label: variantRef.variantLabel,
          price: variantRef.price,
          cost: variantRef.cost,
          qty: qtyDelta,
        })
        .select()
        .single();

      if (!error && data) {
        setSales((prev) => {
          const updatedList = (prev[selectedDate] || []).map((l) =>
            l.id === tempId ? { ...l, id: data.id } : l
          );
          return { ...prev, [selectedDate]: updatedList };
        });
      }
    }
  };

  const removeSaleLine = async (lineId) => {
    const list = (sales[selectedDate] || []).filter((s) => s.id !== lineId);
    setSales({ ...sales, [selectedDate]: list });
    flashSaved();
    await supabase.from("sales").delete().eq("id", lineId);
  };

  const addExpense = async (entry) => {
    const tempId = uid();
    const list = expenses[selectedDate] ? [...expenses[selectedDate]] : [];
    list.push({ id: tempId, ...entry });
    setExpenses({ ...expenses, [selectedDate]: list });
    flashSaved();

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        expense_date: selectedDate,
        type: entry.type,
        amount: entry.amount,
        note: entry.note || null,
      })
      .select()
      .single();

    if (!error && data) {
      setExpenses((prev) => {
        const updatedList = (prev[selectedDate] || []).map((e) =>
          e.id === tempId ? { ...e, id: data.id } : e
        );
        return { ...prev, [selectedDate]: updatedList };
      });
    }
  };

  const removeExpense = async (id) => {
    const list = (expenses[selectedDate] || []).filter((e) => e.id !== id);
    setExpenses({ ...expenses, [selectedDate]: list });
    flashSaved();
    await supabase.from("expenses").delete().eq("id", id);
  };

  const addSample = async (variantRef, qtyDelta) => {
    const list = samples[selectedDate] ? [...samples[selectedDate]] : [];
    const idx = list.findIndex(
      (s) => s.menuId === variantRef.menuId && s.variantId === variantRef.variantId
    );

    flashSaved();

    if (idx >= 0) {
      const newQty = list[idx].qty + qtyDelta;
      if (newQty <= 0) {
        const lineId = list[idx].id;
        list.splice(idx, 1);
        setSamples({ ...samples, [selectedDate]: list });
        await supabase.from("samples").delete().eq("id", lineId);
      } else {
        list[idx] = { ...list[idx], qty: newQty };
        setSamples({ ...samples, [selectedDate]: list });
        await supabase
          .from("samples")
          .update({ qty: newQty })
          .eq("id", list[idx].id);
      }
    } else if (qtyDelta > 0) {
      const tempId = uid();
      const newLine = {
        id: tempId,
        menuId: variantRef.menuId,
        variantId: variantRef.variantId,
        menuName: variantRef.menuName,
        variantLabel: variantRef.variantLabel,
        cost: variantRef.cost,
        qty: qtyDelta,
      };
      list.push(newLine);
      setSamples({ ...samples, [selectedDate]: list });

      const { data, error } = await supabase
        .from("samples")
        .insert({
          sample_date: selectedDate,
          menu_id: variantRef.menuId,
          variant_id: variantRef.variantId,
          menu_name: variantRef.menuName,
          variant_label: variantRef.variantLabel,
          cost: variantRef.cost,
          qty: qtyDelta,
        })
        .select()
        .single();

      if (!error && data) {
        setSamples((prev) => {
          const updatedList = (prev[selectedDate] || []).map((l) =>
            l.id === tempId ? { ...l, id: data.id } : l
          );
          return { ...prev, [selectedDate]: updatedList };
        });
      }
    }
  };

  const removeSampleLine = async (lineId) => {
    const list = (samples[selectedDate] || []).filter((s) => s.id !== lineId);
    setSamples({ ...samples, [selectedDate]: list });
    flashSaved();
    await supabase.from("samples").delete().eq("id", lineId);
  };

  const saveMenus = async (nextMenus, action, payload) => {
    flashSaved();
    if (action === "delete") {
      await supabase.from("menus").delete().eq("id", payload.id);
      setMenus(nextMenus);
      return;
    }
    if (action === "upsert") {
      const { menu, isNew } = payload;
      if (isNew) {
        const { data: menuRow, error: menuErr } = await supabase
          .from("menus")
          .insert({ name: menu.name })
          .select()
          .single();
        if (menuErr) {
          console.error(menuErr);
          return;
        }
        const variantRows = menu.variants.map((v) => ({
          menu_id: menuRow.id,
          label: v.label,
          price: v.price,
          cost: v.cost,
        }));
        await supabase.from("menu_variants").insert(variantRows);
        await reloadAll();
      } else {
        await supabase
          .from("menus")
          .update({ name: menu.name })
          .eq("id", menu.id);

        // Simplest robust approach: delete old variants, insert new ones
        await supabase.from("menu_variants").delete().eq("menu_id", menu.id);
        const variantRows = menu.variants.map((v) => ({
          menu_id: menu.id,
          label: v.label,
          price: v.price,
          cost: v.cost,
        }));
        await supabase.from("menu_variants").insert(variantRows);
        await reloadAll();
      }
    }
  };

  // ---- derived ----

  const dayLines = sales[selectedDate] || [];
  const dayExpenseLines = expenses[selectedDate] || [];
  const daySampleLines = samples[selectedDate] || [];

  const dayRevenue = dayLines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const dayCOGS = dayLines.reduce((sum, l) => sum + l.cost * l.qty, 0);
  const dayExpenseTotal = dayExpenseLines.reduce((s, e) => s + e.amount, 0);
  const daySampleCost = daySampleLines.reduce((s, l) => s + l.cost * l.qty, 0);
  const dayProfit = dayRevenue - dayCOGS - dayExpenseTotal - daySampleCost;
  const dayCupsSold = dayLines.reduce((sum, l) => sum + l.qty, 0);
  const daySampleCups = daySampleLines.reduce((sum, l) => sum + l.qty, 0);

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F1E8] px-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-[#A6443A] mx-auto mb-3" />
          <h2 className="font-display font-semibold text-lg mb-2">
            เชื่อมต่อฐานข้อมูลไม่ได้
          </h2>
          <p className="text-sm text-[#3D2B1F]/60">
            ตรวจสอบว่าตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
            ถูกต้องใน Environment Variables ของ Vercel แล้วหรือยัง
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F1E8]">
        <Loader2 className="w-8 h-8 text-[#B8763E] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F1E8] text-[#3D2B1F] font-sans flex flex-col">
      <Header saveState={saveState} />

      <div className="flex-1 max-w-2xl w-full mx-auto px-4 pb-28 pt-4">
        {tab === "record" && (
          <RecordTab
            menus={menus}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            dayLines={dayLines}
            dayExpenseLines={dayExpenseLines}
            daySampleLines={daySampleLines}
            dayRevenue={dayRevenue}
            dayCOGS={dayCOGS}
            dayExpenseTotal={dayExpenseTotal}
            daySampleCost={daySampleCost}
            dayProfit={dayProfit}
            dayCupsSold={dayCupsSold}
            daySampleCups={daySampleCups}
            onAddSale={addSale}
            onRemoveSaleLine={removeSaleLine}
            onAddExpense={addExpense}
            onRemoveExpense={removeExpense}
            onAddSample={addSample}
            onRemoveSampleLine={removeSampleLine}
          />
        )}
        {tab === "menu" && <MenuTab menus={menus} onSave={saveMenus} />}
        {tab === "summary" && (
          <SummaryTab menus={menus} sales={sales} expenses={expenses} samples={samples} />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

// ---------- header ----------

function Header({ saveState }) {
  return (
    <div className="sticky top-0 z-20 bg-[#F7F1E8]/95 backdrop-blur-sm border-b border-[#3D2B1F]/10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#3D2B1F] flex items-center justify-center">
            <Coffee className="w-4 h-4 text-[#F7F1E8]" />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">
            ร้านบันทึก
          </span>
        </div>
        <div className="h-5 flex items-center">
          {saveState === "saving" && (
            <span className="text-xs text-[#3D2B1F]/40 font-mono">บันทึก...</span>
          )}
          {saveState === "saved" && (
            <span className="text-xs text-[#7A8B5C] font-mono flex items-center gap-1">
              <Check className="w-3 h-3" /> บันทึกแล้ว
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- bottom nav ----------

function BottomNav({ tab, setTab }) {
  const items = [
    { id: "record", label: "บันทึกขาย", icon: Receipt },
    { id: "menu", label: "เมนู", icon: ListOrdered },
    { id: "summary", label: "สรุปผล", icon: TrendingUp },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#3D2B1F] border-t border-black/20">
      <div className="max-w-2xl mx-auto grid grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`flex flex-col items-center gap-1 py-3 transition-colors ${
                active ? "text-[#E8DCC8]" : "text-[#E8DCC8]/40"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[11px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- date picker chip ----------

function DateBar({ selectedDate, setSelectedDate }) {
  const isToday = selectedDate === todayStr();
  const shift = (delta) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    setSelectedDate(next);
  };
  return (
    <div className="flex items-center justify-between mb-4">
      <button
        onClick={() => shift(-1)}
        className="w-8 h-8 rounded-full bg-[#E8DCC8] flex items-center justify-center active:scale-95 transition-transform"
        aria-label="วันก่อนหน้า"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
      </button>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[#B8763E]" />
        <span className="font-mono font-medium text-sm">
          {dayLabel(selectedDate)} {isToday && "· วันนี้"}
        </span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="opacity-0 absolute w-0 h-0"
          id="date-hidden-input"
        />
        <label
          htmlFor="date-hidden-input"
          className="text-[11px] text-[#B8763E] underline cursor-pointer"
        >
          เปลี่ยนวัน
        </label>
      </div>
      <button
        onClick={() => shift(1)}
        className="w-8 h-8 rounded-full bg-[#E8DCC8] flex items-center justify-center active:scale-95 transition-transform"
        aria-label="วันถัดไป"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------- record tab ----------

function RecordTab({
  menus,
  selectedDate,
  setSelectedDate,
  dayLines,
  dayExpenseLines,
  daySampleLines,
  dayRevenue,
  dayCOGS,
  dayExpenseTotal,
  daySampleCost,
  dayProfit,
  dayCupsSold,
  daySampleCups,
  onAddSale,
  onRemoveSaleLine,
  onAddExpense,
  onRemoveExpense,
  onAddSample,
  onRemoveSampleLine,
}) {
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const qtyFor = (menuId, variantId) => {
    const line = dayLines.find(
      (l) => l.menuId === menuId && l.variantId === variantId
    );
    return line ? line.qty : 0;
  };

  const sampleQtyFor = (menuId, variantId) => {
    const line = daySampleLines.find(
      (l) => l.menuId === menuId && l.variantId === variantId
    );
    return line ? line.qty : 0;
  };

  if (menus.length === 0) {
    return (
      <EmptyState
        title="ยังไม่มีเมนู"
        subtitle="ไปที่แท็บ “เมนู” เพื่อเพิ่มเมนูและต้นทุนก่อน"
      />
    );
  }

  return (
    <div>
      <DateBar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />

      <ReceiptSummary
        revenue={dayRevenue}
        cogs={dayCOGS}
        expenses={dayExpenseTotal}
        sampleCost={daySampleCost}
        profit={dayProfit}
        cups={dayCupsSold}
      />

      <div className="mt-6">
        <h3 className="font-display font-semibold text-base mb-3">
          แตะเพิ่มยอดขาย
        </h3>
        <div className="space-y-3">
          {menus.map((menu) => (
            <div
              key={menu.id}
              className="bg-white/60 rounded-2xl p-3 border border-[#3D2B1F]/8"
            >
              <div className="font-medium text-sm mb-2">{menu.name}</div>
              <div className="flex flex-wrap gap-2">
                {menu.variants.map((v) => {
                  const qty = qtyFor(menu.id, v.id);
                  return (
                    <div
                      key={v.id}
                      className={`flex items-center rounded-xl border transition-colors ${
                        qty > 0
                          ? "border-[#B8763E] bg-[#B8763E]/10"
                          : "border-[#3D2B1F]/15 bg-white"
                      }`}
                    >
                      <button
                        onClick={() =>
                          onAddSale(
                            {
                              menuId: menu.id,
                              variantId: v.id,
                              menuName: menu.name,
                              variantLabel: v.label,
                              price: v.price,
                              cost: v.cost,
                            },
                            -1
                          )
                        }
                        disabled={qty === 0}
                        className="w-8 h-9 flex items-center justify-center disabled:opacity-20 active:scale-90 transition-transform"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <div className="px-1 min-w-[3.2rem] text-center">
                        <div className="text-xs leading-tight">{v.label}</div>
                        <div className="font-mono text-sm font-semibold leading-tight">
                          {qty}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          onAddSale(
                            {
                              menuId: menu.id,
                              variantId: v.id,
                              menuName: menu.name,
                              variantLabel: v.label,
                              price: v.price,
                              cost: v.cost,
                            },
                            1
                          )
                        }
                        className="w-8 h-9 flex items-center justify-center active:scale-90 transition-transform text-[#B8763E]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {dayLines.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display font-semibold text-base mb-3">
            รายการขายวันนี้
          </h3>
          <div className="bg-white/60 rounded-2xl border border-[#3D2B1F]/8 divide-y divide-[#3D2B1F]/8">
            {dayLines.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium">{l.menuName}</span>
                  <span className="text-[#3D2B1F]/50"> · {l.variantLabel}</span>
                  <span className="text-[#3D2B1F]/50"> ×{l.qty}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">
                    {fmtBaht(l.price * l.qty)}
                  </span>
                  <button
                    onClick={() => onRemoveSaleLine(l.id)}
                    className="text-[#A6443A]/60 active:scale-90 transition-transform"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-base">
            ค่าใช้จ่ายวันนี้
          </h3>
          <button
            onClick={() => setShowExpenseForm(true)}
            className="text-xs font-medium text-[#B8763E] flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่ม
          </button>
        </div>

        {dayExpenseLines.length === 0 && !showExpenseForm && (
          <p className="text-sm text-[#3D2B1F]/40">
            ยังไม่มีค่าใช้จ่ายบันทึกไว้วันนี้
          </p>
        )}

        {dayExpenseLines.length > 0 && (
          <div className="bg-white/60 rounded-2xl border border-[#3D2B1F]/8 divide-y divide-[#3D2B1F]/8 mb-3">
            {dayExpenseLines.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium">{e.type}</span>
                  {e.note && (
                    <span className="text-[#3D2B1F]/50"> · {e.note}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{fmtBaht(e.amount)}</span>
                  <button
                    onClick={() => onRemoveExpense(e.id)}
                    className="text-[#A6443A]/60 active:scale-90 transition-transform"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showExpenseForm && (
          <ExpenseForm
            onCancel={() => setShowExpenseForm(false)}
            onSubmit={(entry) => {
              onAddExpense(entry);
              setShowExpenseForm(false);
            }}
          />
        )}
      </div>

      <div className="mt-6">
        <h3 className="font-display font-semibold text-base mb-3">
          แจกชิมวันนี้ · {daySampleCups} แก้ว
        </h3>
        <div className="space-y-3">
          {menus.map((menu) => (
            <div
              key={menu.id}
              className="bg-white/60 rounded-2xl p-3 border border-[#3D2B1F]/8"
            >
              <div className="font-medium text-sm mb-2">{menu.name}</div>
              <div className="flex flex-wrap gap-2">
                {menu.variants.map((v) => {
                  const qty = sampleQtyFor(menu.id, v.id);
                  return (
                    <div
                      key={v.id}
                      className={`flex items-center rounded-xl border transition-colors ${
                        qty > 0
                          ? "border-[#7A8B5C] bg-[#7A8B5C]/10"
                          : "border-[#3D2B1F]/15 bg-white"
                      }`}
                    >
                      <button
                        onClick={() =>
                          onAddSample(
                            {
                              menuId: menu.id,
                              variantId: v.id,
                              menuName: menu.name,
                              variantLabel: v.label,
                              cost: v.cost,
                            },
                            -1
                          )
                        }
                        disabled={qty === 0}
                        className="w-8 h-9 flex items-center justify-center disabled:opacity-20 active:scale-90 transition-transform"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <div className="px-1 min-w-[3.2rem] text-center">
                        <div className="text-xs leading-tight">{v.label}</div>
                        <div className="font-mono text-sm font-semibold leading-tight">
                          {qty}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          onAddSample(
                            {
                              menuId: menu.id,
                              variantId: v.id,
                              menuName: menu.name,
                              variantLabel: v.label,
                              cost: v.cost,
                            },
                            1
                          )
                        }
                        className="w-8 h-9 flex items-center justify-center active:scale-90 transition-transform text-[#7A8B5C]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {daySampleLines.length > 0 && (
          <div className="bg-white/60 rounded-2xl border border-[#3D2B1F]/8 divide-y divide-[#3D2B1F]/8 mt-3">
            {daySampleLines.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium">{l.menuName}</span>
                  <span className="text-[#3D2B1F]/50"> · {l.variantLabel}</span>
                  <span className="text-[#3D2B1F]/50"> ×{l.qty}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-[#7A8B5C]">
                    ทุน ฿{fmtBaht(l.cost * l.qty)}
                  </span>
                  <button
                    onClick={() => onRemoveSampleLine(l.id)}
                    className="text-[#A6443A]/60 active:scale-90 transition-transform"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptSummary({ revenue, cogs, expenses, sampleCost, profit, cups }) {
  const isProfit = profit >= 0;
  return (
    <div className="bg-[#3D2B1F] text-[#F7F1E8] rounded-2xl p-5 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent, transparent 4px, #F7F1E8 4px, #F7F1E8 8px)",
          maskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />
      <div className="font-mono text-[11px] uppercase tracking-widest text-[#E8DCC8]/60 mb-3">
        สรุปยอดวันนี้ · {cups} แก้ว
      </div>
      <div className="space-y-1.5 font-mono text-sm">
        <Row label="ยอดขาย" value={revenue} />
        <Row label="ต้นทุนวัตถุดิบ" value={-cogs} muted />
        <Row label="ค่าใช้จ่ายอื่น" value={-expenses} muted />
        <Row label="ต้นทุนแจกชิม" value={-sampleCost} muted />
      </div>
      <div className="border-t border-dashed border-[#E8DCC8]/30 my-3" />
      <div className="flex items-center justify-between">
        <span className="font-display font-semibold">
          {isProfit ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}
        </span>
        <span
          className={`font-mono text-xl font-bold flex items-center gap-1 ${
            isProfit ? "text-[#A8C08A]" : "text-[#E08A7D]"
          }`}
        >
          {isProfit ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          ฿{fmtBaht(Math.abs(profit))}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }) {
  const neg = value < 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#E8DCC8]/70">{label}</span>
      <span className={muted ? "text-[#E8DCC8]/70" : ""}>
        {neg ? "-" : ""}฿{fmtBaht(Math.abs(value))}
      </span>
    </div>
  );
}

function ExpenseForm({ onCancel, onSubmit }) {
  const [type, setType] = useState(EXPENSE_TYPES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    onSubmit({ type, amount: amt, note: note.trim() });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#3D2B1F]/10 p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {EXPENSE_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              type === t
                ? "bg-[#3D2B1F] text-[#F7F1E8] border-[#3D2B1F]"
                : "border-[#3D2B1F]/20 text-[#3D2B1F]/70"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        type="number"
        inputMode="decimal"
        placeholder="จำนวนเงิน (บาท)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full bg-[#F7F1E8] rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-[#B8763E]"
      />
      <input
        type="text"
        placeholder="โน้ตเพิ่มเติม (ไม่บังคับ)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full bg-[#F7F1E8] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#B8763E]"
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#3D2B1F]/60 border border-[#3D2B1F]/15"
        >
          ยกเลิก
        </button>
        <button
          onClick={submit}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#B8763E] text-white"
        >
          บันทึก
        </button>
      </div>
    </div>
  );
}

// ---------- menu tab ----------

function MenuTab({ menus, onSave }) {
  const [editingMenu, setEditingMenu] = useState(null);

  const deleteMenu = (menu) => {
    const next = menus.filter((m) => m.id !== menu.id);
    onSave(next, "delete", { id: menu.id });
  };

  const upsertMenu = (menu, isNew) => {
    const next = isNew
      ? [...menus, menu]
      : menus.map((m) => (m.id === menu.id ? menu : m));
    onSave(next, "upsert", { menu, isNew });
    setEditingMenu(null);
  };

  if (editingMenu) {
    return (
      <MenuEditor
        initial={editingMenu === "new" ? null : editingMenu}
        onCancel={() => setEditingMenu(null)}
        onSave={(menu) => upsertMenu(menu, editingMenu === "new")}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-xl">เมนู &amp; ต้นทุน</h2>
        <button
          onClick={() => setEditingMenu("new")}
          className="flex items-center gap-1 bg-[#3D2B1F] text-[#F7F1E8] text-sm font-medium px-3 py-2 rounded-xl active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" /> เพิ่มเมนู
        </button>
      </div>

      {menus.length === 0 && (
        <EmptyState title="ยังไม่มีเมนู" subtitle="เริ่มเพิ่มเมนูแรกของร้านได้เลย" />
      )}

      <div className="space-y-3">
        {menus.map((menu) => {
          const minMargin =
            menu.variants.length > 0
              ? Math.min(...menu.variants.map((v) => v.price - v.cost))
              : 0;
          const marginOk = minMargin > 0;
          return (
            <div
              key={menu.id}
              className="bg-white/60 rounded-2xl border border-[#3D2B1F]/8 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium">{menu.name}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingMenu(menu)}
                    className="text-xs text-[#B8763E] font-medium"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => deleteMenu(menu)}
                    className="text-[#A6443A]/60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {menu.variants.map((v) => {
                  const margin = v.price - v.cost;
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between text-sm font-mono bg-[#F7F1E8] rounded-lg px-3 py-1.5"
                    >
                      <span className="font-sans">{v.label}</span>
                      <span className="flex items-center gap-3 text-xs">
                        <span>ขาย ฿{fmtBaht(v.price)}</span>
                        <span className="text-[#3D2B1F]/50">
                          ทุน ฿{fmtBaht(v.cost)}
                        </span>
                        <span
                          className={
                            margin > 0 ? "text-[#7A8B5C]" : "text-[#A6443A]"
                          }
                        >
                          กำไร/แก้ว ฿{fmtBaht(margin)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              {!marginOk && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-[#A6443A]">
                  <AlertCircle className="w-3.5 h-3.5" /> มีตัวเลือกที่ขายต่ำกว่าทุน
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MenuEditor({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [variants, setVariants] = useState(
    initial?.variants?.map((v) => ({ ...v })) || [
      { id: uid(), label: "ปกติ", price: "", cost: "" },
    ]
  );

  const updateVariant = (id, field, value) => {
    setVariants((vs) =>
      vs.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const addVariant = () => {
    setVariants((vs) => [...vs, { id: uid(), label: "", price: "", cost: "" }]);
  };

  const removeVariant = (id) => {
    setVariants((vs) => (vs.length > 1 ? vs.filter((v) => v.id !== id) : vs));
  };

  const canSave =
    name.trim().length > 0 &&
    variants.every(
      (v) =>
        v.label.trim().length > 0 &&
        v.price !== "" &&
        v.cost !== "" &&
        !isNaN(parseFloat(v.price)) &&
        !isNaN(parseFloat(v.cost))
    );

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: initial?.id,
      name: name.trim(),
      variants: variants.map((v) => ({
        id: v.id,
        label: v.label.trim(),
        price: parseFloat(v.price),
        cost: parseFloat(v.cost),
      })),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-xl">
          {initial ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}
        </h2>
        <button onClick={onCancel} className="text-[#3D2B1F]/40">
          <X className="w-5 h-5" />
        </button>
      </div>

      <label className="block text-xs font-medium text-[#3D2B1F]/60 mb-1">
        ชื่อเมนู
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="เช่น ลาเต้, ชาไทย"
        className="w-full bg-white rounded-xl px-3 py-2.5 text-sm mb-4 outline-none focus:ring-2 focus:ring-[#B8763E] border border-[#3D2B1F]/10"
      />

      <label className="block text-xs font-medium text-[#3D2B1F]/60 mb-2">
        ขนาด / ตัวเลือก (แต่ละแบบมีราคาขาย-ต้นทุนของตัวเอง)
      </label>
      <div className="space-y-2 mb-3">
        {variants.map((v) => (
          <div
            key={v.id}
            className="bg-white rounded-xl border border-[#3D2B1F]/10 p-3 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="ขนาด เช่น เล็ก/ร้อน"
              value={v.label}
              onChange={(e) => updateVariant(v.id, "label", e.target.value)}
              className="flex-1 min-w-0 text-sm outline-none bg-transparent"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="ราคาขาย"
              value={v.price}
              onChange={(e) => updateVariant(v.id, "price", e.target.value)}
              className="w-20 text-sm font-mono outline-none bg-[#F7F1E8] rounded-lg px-2 py-1.5 text-center"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="ต้นทุน"
              value={v.cost}
              onChange={(e) => updateVariant(v.id, "cost", e.target.value)}
              className="w-20 text-sm font-mono outline-none bg-[#F7F1E8] rounded-lg px-2 py-1.5 text-center"
            />
            <button
              onClick={() => removeVariant(v.id)}
              disabled={variants.length === 1}
              className="text-[#A6443A]/60 disabled:opacity-20"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addVariant}
        className="text-sm text-[#B8763E] font-medium flex items-center gap-1 mb-6"
      >
        <Plus className="w-4 h-4" /> เพิ่มขนาด/ตัวเลือก
      </button>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl text-sm font-medium text-[#3D2B1F]/60 border border-[#3D2B1F]/15"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl text-sm font-medium bg-[#3D2B1F] text-[#F7F1E8] disabled:opacity-30"
        >
          บันทึกเมนู
        </button>
      </div>
    </div>
  );
}

// ---------- summary tab ----------

function SummaryTab({ menus, sales, expenses, samples }) {
  const [range, setRange] = useState("7");

  const allDates = useMemo(() => {
    const set = new Set([
      ...Object.keys(sales),
      ...Object.keys(expenses),
      ...Object.keys(samples),
    ]);
    return Array.from(set).sort();
  }, [sales, expenses, samples]);

  const filteredDates = useMemo(() => {
    if (allDates.length === 0) return [];
    if (range === "month") {
      const m = monthStr(todayStr());
      return allDates.filter((d) => monthStr(d) === m);
    }
    const n = parseInt(range, 10);
    const today = todayStr();
    const cutoff = new Date(today + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - (n - 1));
    return allDates.filter((d) => new Date(d + "T00:00:00") >= cutoff);
  }, [allDates, range]);

  const dailyStats = useMemo(() => {
    return filteredDates.map((date) => {
      const lines = sales[date] || [];
      const exLines = expenses[date] || [];
      const sampleLines = samples[date] || [];
      const revenue = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const cogs = lines.reduce((s, l) => s + l.cost * l.qty, 0);
      const exTotal = exLines.reduce((s, e) => s + e.amount, 0);
      const sampleCost = sampleLines.reduce((s, l) => s + l.cost * l.qty, 0);
      const profit = revenue - cogs - exTotal - sampleCost;
      return { date, revenue, cogs, exTotal, sampleCost, profit };
    });
  }, [filteredDates, sales, expenses, samples]);

  const totals = useMemo(() => {
    return dailyStats.reduce(
      (acc, d) => ({
        revenue: acc.revenue + d.revenue,
        cogs: acc.cogs + d.cogs,
        exTotal: acc.exTotal + d.exTotal,
        sampleCost: acc.sampleCost + d.sampleCost,
        profit: acc.profit + d.profit,
      }),
      { revenue: 0, cogs: 0, exTotal: 0, sampleCost: 0, profit: 0 }
    );
  }, [dailyStats]);

  const menuRanking = useMemo(() => {
    const map = new Map();
    filteredDates.forEach((date) => {
      (sales[date] || []).forEach((l) => {
        const key = `${l.menuId}-${l.variantId}`;
        const cur =
          map.get(key) || {
            name: l.menuName,
            label: l.variantLabel,
            qty: 0,
            revenue: 0,
            profit: 0,
          };
        cur.qty += l.qty;
        cur.revenue += l.price * l.qty;
        cur.profit += (l.price - l.cost) * l.qty;
        map.set(key, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [filteredDates, sales]);

  const chartData = dailyStats.map((d) => ({
    label: dayLabel(d.date),
    profit: Math.round(d.profit),
    revenue: Math.round(d.revenue),
  }));

  const isEmpty = dailyStats.length === 0;

  return (
    <div>
      <h2 className="font-display font-semibold text-xl mb-4">สรุปผล</h2>

      <div className="flex gap-2 mb-5">
        {[
          { id: "7", label: "7 วัน" },
          { id: "30", label: "30 วัน" },
          { id: "month", label: "เดือนนี้" },
        ].map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              range === r.id
                ? "bg-[#3D2B1F] text-[#F7F1E8] border-[#3D2B1F]"
                : "border-[#3D2B1F]/20 text-[#3D2B1F]/70"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <EmptyState
          title="ยังไม่มีข้อมูล"
          subtitle="เริ่มบันทึกยอดขายในแท็บ “บันทึกขาย” ก่อน แล้วค่อยกลับมาดูสรุป"
        />
      ) : (
        <>
          <div className="bg-[#3D2B1F] text-[#F7F1E8] rounded-2xl p-5 mb-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-[#E8DCC8]/60 mb-3">
              รวม {filteredDates.length} วัน
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-sm">
              <Stat label="ยอดขาย" value={totals.revenue} />
              <Stat label="ต้นทุนวัตถุดิบ" value={totals.cogs} />
              <Stat label="ค่าใช้จ่ายอื่น" value={totals.exTotal} />
              <Stat label="ต้นทุนแจกชิม" value={totals.sampleCost} />
              <Stat
                label={totals.profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}
                value={Math.abs(totals.profit)}
                highlight={totals.profit >= 0 ? "good" : "bad"}
              />
            </div>
          </div>

          <div className="bg-white/60 rounded-2xl border border-[#3D2B1F]/8 p-4 mb-5">
            <h3 className="font-display font-semibold text-sm mb-3">
              แนวโน้มกำไรรายวัน
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#3D2B1F"
                  strokeOpacity={0.08}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#3D2B1F99" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#3D2B1F99" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [`฿${fmtBaht(v)}`, "กำไร"]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #3D2B1F22",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#B8763E"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#B8763E" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white/60 rounded-2xl border border-[#3D2B1F]/8 p-4">
            <h3 className="font-display font-semibold text-sm mb-3">
              เมนูขายดี — ขายไม่ดี
            </h3>
            <div className="space-y-2">
              {menuRanking.map((m, i) => {
                const maxQty = menuRanking[0]?.qty || 1;
                const pct = Math.max(6, (m.qty / maxQty) * 100);
                const isTop = i === 0;
                const isBottom =
                  i === menuRanking.length - 1 && menuRanking.length > 1;
                return (
                  <div key={`${m.name}-${m.label}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">
                        {m.name} · {m.label}
                        {isTop && (
                          <span className="ml-1.5 text-[#7A8B5C]">ขายดีสุด</span>
                        )}
                        {isBottom && (
                          <span className="ml-1.5 text-[#A6443A]">ขายน้อยสุด</span>
                        )}
                      </span>
                      <span className="font-mono text-[#3D2B1F]/60">
                        {m.qty} แก้ว · ฿{fmtBaht(m.revenue)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#3D2B1F]/8 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isTop ? "#7A8B5C" : "#B8763E",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  const color =
    highlight === "good"
      ? "text-[#A8C08A]"
      : highlight === "bad"
      ? "text-[#E08A7D]"
      : "text-[#F7F1E8]";
  return (
    <div>
      <div className="text-[#E8DCC8]/60 text-[11px]">{label}</div>
      <div className={`font-semibold text-base ${color}`}>
        ฿{fmtBaht(value)}
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#E8DCC8] flex items-center justify-center mb-4">
        <Coffee className="w-6 h-6 text-[#B8763E]" />
      </div>
      <h3 className="font-display font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-[#3D2B1F]/50">{subtitle}</p>
    </div>
  );
}
