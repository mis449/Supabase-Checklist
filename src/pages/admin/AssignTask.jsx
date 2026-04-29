import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  ClipboardList, Send, Plus, Trash2, CheckCircle2,
  Loader2, Calendar, Clock, Building2, User, Users,
  FileText, Repeat, ArrowLeft, ChevronDown, Zap, RefreshCw
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { assignTaskInTable, uniqueDepartmentData, uniqueDoerNameData, uniqueGivenByData } from "../../redux/slice/assignTaskSlice";
import { useMagicToast } from "../../context/MagicToastContext";
import supabase from "../../SupabaseClient";

const RECURRING_FREQUENCIES = [
  "Alternate Day", "Daily", "Weekly",
  "Fortnight", "Monthly", "Quarterly", "Half Yearly", "Yearly"
];

const freqMap = {
  "One Time (No Recurrence)": "one-time",
  "Alternate Day": "alternate-day",
  "Daily": "daily",
  "Weekly": "weekly",
  "Fortnight": "fortnight",
  "Monthly": "monthly",
  "Quarterly": "quarterly",
  "Half Yearly": "half-yearly",
  "Yearly": "yearly"
};

const formatDateISO = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultDelegationTask = () => ({
  department: "",
  givenBy: "",
  doer: "",
  description: "",
  startDate: "",
  startTime: "09:00",
  duration: "",
});

const defaultChecklistTask = () => ({
  id: Date.now() + Math.random(),
  department: "",
  givenBy: "",
  doer: "",
  description: "",
  startDate: "",
  startTime: "09:00",
  duration: "",
  frequency: "Daily",
});

// --- Shared Field Components ---
function FieldLabel({ icon: Icon, label, required }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
      {Icon && <Icon size={12} className="text-gray-400" />}
      {label} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

function SelectField({ icon: Icon, label, value, onChange, options, placeholder, required }) {
  return (
    <div>
      <FieldLabel icon={Icon} label={label} required={required} />
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          required={required}
          className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all pr-8"
        >
          <option value="">{placeholder || `Select ${label}`}</option>
          {options.map((opt) => (
            <option key={typeof opt === "object" ? opt.value : opt} value={typeof opt === "object" ? opt.value : opt}>
              {typeof opt === "object" ? opt.label : opt}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

function InputField({ icon: Icon, label, type = "text", value, onChange, placeholder, required }) {
  return (
    <div>
      <FieldLabel icon={Icon} label={label} required={required} />
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
      />
    </div>
  );
}

function TextAreaField({ icon: Icon, label, value, onChange, placeholder, required }) {
  return (
    <div>
      <FieldLabel icon={Icon} label={label} required={required} />
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={3}
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all resize-none"
      />
    </div>
  );
}

// --- Delegation Form ---
function DelegationForm({ departments, givenByList, doerList, onSubmit, isSubmitting }) {
  const [form, setForm] = useState(defaultDelegationTask());
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const filteredDoers = doerList.filter((u) => {
    if (!u || typeof u !== "object") return false;
    if (u.status === "inactive") return false;
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const me = (localStorage.getItem("user-name") || "").toLowerCase();
    if (role === "hod") {
      const name = (u.user_name || "").toLowerCase();
      const rep = (u.reported_by || "").toLowerCase();
      if (name !== me && rep !== me) return false;
      if (name === me && !u.can_self_assign) return false;
    }
    return true;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit([{ ...form, frequency: "One Time (No Recurrence)" }]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          icon={Building2} label="Department" value={form.department}
          onChange={set("department")} options={departments} required
        />
        <SelectField
          icon={User} label="Assign From" value={form.givenBy}
          onChange={set("givenBy")} options={givenByList} required
        />
        <SelectField
          icon={Users} label="Doers name" value={form.doer}
          onChange={(e) => setForm((p) => ({ ...p, doer: e.target.value }))}
          options={filteredDoers.map((u) => ({ value: u.user_name, label: u.user_name }))}
          placeholder="Select Doer" required
        />
      </div>

      <TextAreaField icon={FileText} label="Description" value={form.description} onChange={set("description")} placeholder="Describe the task..." required />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InputField icon={Calendar} label="Start Date" type="date" value={form.startDate} onChange={set("startDate")} required />
        <InputField icon={Clock} label="Start Time" type="time" value={form.startTime} onChange={set("startTime")} required />
        <InputField icon={Clock} label="Duration (e.g. 1hr)" value={form.duration} onChange={set("duration")} placeholder="e.g. 30 mins" required />
      </div>

      <div className="pt-2">
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium mb-4">
          <Zap size={14} className="text-amber-500 shrink-0" />
          This task will be assigned as a <strong>One-Time (No Recurrence)</strong> task in the Delegation table.
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-200 transition-all duration-200 disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {isSubmitting ? "Submitting..." : "Submit Delegation Task"}
        </button>
      </div>
    </form>
  );
}

// --- Checklist Task Row ---
function ChecklistTaskRow({ task, index, total, departments, givenByList, doerList, onUpdate, onRemove }) {
  const set = (key) => (e) => onUpdate(task.id, { [key]: e.target.value });

  const filteredDoers = doerList.filter((u) => {
    if (!u || typeof u !== "object") return false;
    if (u.status === "inactive") return false;
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const me = (localStorage.getItem("user-name") || "").toLowerCase();
    if (role === "hod") {
      const name = (u.user_name || "").toLowerCase();
      const rep = (u.reported_by || "").toLowerCase();
      if (name !== me && rep !== me) return false;
      if (name === me && !u.can_self_assign) return false;
    }
    return true;
  });

  return (
    <div className="bg-white border border-purple-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black">{index + 1}</div>
          <span className="text-sm font-bold text-purple-800">Task {index + 1}</span>
        </div>
        {total > 1 && (
          <button type="button" onClick={() => onRemove(task.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField icon={Building2} label="Department" value={task.department} onChange={set("department")} options={departments} required />
          <SelectField
            icon={User} label="Assign From" value={task.givenBy}
            onChange={(e) => onUpdate(task.id, { givenBy: e.target.value })}
            options={givenByList}
            placeholder="Select Assign From" required
          />
          <SelectField
            icon={Users} label="Doers name" value={task.doer}
            onChange={(e) => onUpdate(task.id, { doer: e.target.value })}
            options={filteredDoers.map((u) => ({ value: u.user_name, label: u.user_name }))}
            placeholder="Select Doer" required
          />
          <SelectField
            icon={RefreshCw} label="Frequency" value={task.frequency}
            onChange={set("frequency")}
            options={RECURRING_FREQUENCIES}
            required
          />
        </div>

        <TextAreaField icon={FileText} label="Description" value={task.description} onChange={set("description")} placeholder="Describe the task..." required />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField icon={Calendar} label="Start Date" type="date" value={task.startDate} onChange={set("startDate")} required />
          <InputField icon={Clock} label="Start Time" type="time" value={task.startTime} onChange={set("startTime")} required />
          <InputField icon={Clock} label="Duration" value={task.duration} onChange={set("duration")} placeholder="e.g. 30 mins" required />
        </div>
      </div>
    </div>
  );
}

// --- Checklist Form ---
function ChecklistForm({ departments, givenByList, doerList, onSubmit, isSubmitting }) {
  const [tasks, setTasks] = useState([defaultChecklistTask()]);

  const updateTask = (id, updates) => setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  const addTask = () => setTasks((p) => {
    const last = p[p.length - 1];
    return [...p, { ...defaultChecklistTask(), id: Date.now() + Math.random(), department: last?.department || "", doer: last?.doer || "" }];
  });
  const removeTask = (id) => setTasks((p) => p.filter((t) => t.id !== id));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(tasks.map((t) => ({ ...t, frequency: t.frequency })));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        {tasks.map((task, i) => (
          <ChecklistTaskRow
            key={task.id} task={task} index={i} total={tasks.length}
            departments={departments} givenByList={givenByList} doerList={doerList}
            onUpdate={updateTask} onRemove={removeTask}
          />
        ))}
      </div>

      <button
        type="button" onClick={addTask}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-purple-300 text-purple-600 font-bold text-sm rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all"
      >
        <Plus size={16} /> Add Another Task
      </button>

      <div className="pt-2">
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium mb-4">
          <RefreshCw size={14} className="text-blue-500 shrink-0" />
          These tasks will recur based on the selected frequency and be added to the <strong>Checklist</strong> table.
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200 disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {isSubmitting ? "Submitting..." : `Submit ${tasks.length} Checklist Task${tasks.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </form>
  );
}

// --- Main Page ---
export default function AssignTask() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showToast } = useMagicToast();
  const { department, doerName, givenBy } = useSelector((state) => state.assignTask);
  const [taskType, setTaskType] = useState("delegation"); // "delegation" | "checklist"
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    const role = (localStorage.getItem("role") || "").toLowerCase();
    if (role === "user") navigate("/dashboard/admin");
    dispatch(uniqueDepartmentData());
    dispatch(uniqueGivenByData());
    dispatch(uniqueDoerNameData());
    supabase.from("holidays").select("holiday_date").then(({ data }) => {
      if (data) setHolidays(data.map((h) => h.holiday_date));
    });
  }, [dispatch, navigate]);

  const handleSubmit = async (formTasks) => {
    setIsSubmitting(true);
    try {
      // Validate & build payload
      const allTasksToSubmit = [];

      for (const task of formTasks) {
        if (!task.department || !task.doer || !task.description || !task.startDate || !task.duration) {
          showToast("Please fill all required fields.", "error");
          setIsSubmitting(false);
          return;
        }

        const dateStr = formatDateISO(new Date(task.startDate + "T00:00:00"));

        // Working day check
        const { data: wd } = await supabase.from("working_day_calender").select("working_date").eq("working_date", dateStr);
        const isWorking = wd && wd.length > 0;
        const isHoliday = holidays.includes(dateStr);

        if (taskType === "delegation" && (!isWorking || isHoliday)) {
          showToast(`Date ${dateStr} is a ${isHoliday ? "holiday" : "non-working day"}. Please pick a working day.`, "error");
          setIsSubmitting(false);
          return;
        }

        const freq = taskType === "delegation" ? "One Time (No Recurrence)" : task.frequency;
        const freqKey = freqMap[freq] || "one-time";
        const dueDate = `${dateStr}T${task.startTime || "09:00"}:00`;

        allTasksToSubmit.push({
          department: task.department,
          givenBy: task.givenBy || (givenBy[0] || ""),
          doer: task.doer,
          description: task.description,
          task_description: task.description,
          frequency: freqKey,
          duration: task.duration,
          dueDate,
          enableReminders: true,
          requireAttachment: false,
          status: taskType === "delegation" ? "pending" : null,
        });
      }

      // For recurring checklist tasks, generate all occurrences
      const expandedTasks = [];
      for (const task of allTasksToSubmit) {
        if (task.frequency === "one-time") {
          expandedTasks.push(task);
          continue;
        }
        // Generate occurrences for 1 year
        const startD = new Date(task.dueDate);
        const endD = new Date(startD);
        endD.setFullYear(endD.getFullYear() + 1);

        const { data: workingData } = await supabase
          .from("working_day_calender").select("working_date")
          .gte("working_date", formatDateISO(startD))
          .lte("working_date", formatDateISO(endD));
        const workingSet = new Set(workingData?.map((d) => d.working_date) || []);

        const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
        const isHol = (d) => holidays.includes(formatDateISO(d));
        const isWork = (d) => workingSet.has(formatDateISO(d));
        const timeStr = task.dueDate.split("T")[1] || "09:00:00";

        let current = new Date(startD);
        let attempts = 0;
        const dates = [];

        while (current <= endD && attempts < 1000) {
          attempts++;
          if (task.frequency === "daily" || task.frequency === "alternate-day") {
            if (!isHol(current) && isWork(current)) dates.push(new Date(current));
            current = addDays(current, 1);
            continue;
          }
          // Weekly / monthly etc — shift to next working day
          let target = new Date(current);
          while (target <= endD && (isHol(target) || !isWork(target))) target = addDays(target, 1);
          if (target <= endD) dates.push(new Date(target));

          if (task.frequency === "weekly") current = addDays(current, 7);
          else if (task.frequency === "fortnight") current = addDays(current, 14);
          else if (task.frequency === "monthly") current.setMonth(current.getMonth() + 1);
          else if (task.frequency === "quarterly") current.setMonth(current.getMonth() + 3);
          else if (task.frequency === "half-yearly") current.setMonth(current.getMonth() + 6);
          else if (task.frequency === "yearly") current.setFullYear(current.getFullYear() + 1);
          else break;
        }

        // Alternate-day: pick every other valid day
        const finalDates = task.frequency === "alternate-day"
          ? dates.filter((_, i) => i % 2 === 0) : dates;

        for (const d of finalDates) {
          expandedTasks.push({ ...task, dueDate: `${formatDateISO(d)}T${timeStr}` });
        }
      }

      if (expandedTasks.length === 0) {
        showToast("No valid tasks generated. Check the working day calendar.", "error");
        setIsSubmitting(false);
        return;
      }

      const CHUNK = 100;
      for (let i = 0; i < expandedTasks.length; i += CHUNK) {
        const chunk = expandedTasks.slice(i, i + CHUNK);
        const result = await dispatch(assignTaskInTable({ tasks: chunk, table: null }));
        if (result.error) throw new Error(result.error.message || "Insert failed");
      }

      showToast(`✅ ${expandedTasks.length} task(s) assigned successfully!`, "success");
      setTimeout(() => navigate("/dashboard/admin"), 1800);
    } catch (err) {
      console.error(err);
      showToast(`Failed: ${err.message || "Unknown error"}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900">Task Assignment</h1>
              <p className="text-sm text-gray-500 mt-0.5">Create one-time or recurring tasks</p>
            </div>
          </div>
        </div>

        {/* Task Type Selector */}
        <div className="bg-white border border-gray-200 rounded-2xl p-1.5 flex gap-1.5 mb-6 shadow-sm">
          <button
            type="button"
            onClick={() => setTaskType("delegation")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
              taskType === "delegation"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-200"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <Zap size={16} />
            Delegation Task
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${taskType === "delegation" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
              One-Time
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTaskType("checklist")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
              taskType === "checklist"
                ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-200"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <ClipboardList size={16} />
            Checklist Task
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${taskType === "checklist" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
              Recurring
            </span>
          </button>
        </div>

        {/* Info Banner */}
        <div className={`rounded-2xl border p-4 mb-6 ${taskType === "delegation" ? "bg-purple-50 border-purple-200" : "bg-indigo-50 border-indigo-200"}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl ${taskType === "delegation" ? "bg-purple-600" : "bg-indigo-600"} text-white shrink-0`}>
              {taskType === "delegation" ? <Zap size={16} /> : <RepeatIcon />}
            </div>
            <div>
              <h3 className={`text-sm font-bold ${taskType === "delegation" ? "text-purple-800" : "text-indigo-800"}`}>
                {taskType === "delegation" ? "Delegation Task — One-Time" : "Checklist Task — Recurring"}
              </h3>
              <p className={`text-xs mt-0.5 ${taskType === "delegation" ? "text-purple-600" : "text-indigo-600"}`}>
                {taskType === "delegation"
                  ? "Assign a one-off task to a team member. It will appear in the Delegation module."
                  : "Assign recurring tasks with a frequency. They will appear in the Checklist module and auto-generate for 1 year."}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          {taskType === "delegation" ? (
            <DelegationForm
              departments={department}
              givenByList={givenBy}
              doerList={doerName}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <ChecklistForm
              departments={department}
              givenByList={givenBy}
              doerList={doerName}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function RepeatIcon() {
  return <RefreshCw size={16} />;
}
