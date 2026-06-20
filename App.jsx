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

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  { name: "ลาเต้", variants: [{ label: "ร้อน", price: 45, cost: 18 }, { label: "เย็น", price: 50, cost: 20 }] },
  { name: "ชาไทย", variants: [{ label: "เล็ก", price: 35, cost: 14 }, { label: "ใหญ่", price: 45, cost: 18 }] },
  { name: "อเมริกาโน่", variants: [{ label: "เย็น", price: 40, cost: 12 }] },
export default function App() {
  const [tab, setTab] = useState("record");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [configError, setConfigError] = useState(false);

  const [menus, setMenus] = useState([]);
  const [sales, setSales] = useState({});
  const [expenses, setExpenses] = useState({});

  const [selectedDate, setSelectedDate] = useState(todayStr());

  const reloadAll = useCallback(async () => {
    try {
      const [menuData, { sales: s, expenses: e }] = await Promise.all([
        fetchMenusWithVariants(),
        fetchAllSalesAndExpenses(),
      

];
